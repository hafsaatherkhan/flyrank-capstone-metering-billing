"""
Provider-neutral billing sync logic for subscription lifecycle events.

Maps incoming subscription webhook events (from Polar or another payment provider)
to internal database state (tenants, subscriptions).
"""

from datetime import datetime, timezone
from typing import Any, Optional
from sqlalchemy.orm import Session

from app.models import Plan, Tenant, Subscription


def parse_iso_datetime(dt_str: Optional[str]) -> Optional[datetime]:
    """Parse ISO datetime string to timezone-aware UTC datetime."""
    if not dt_str:
        return None
    # Handle 'Z' suffix or standard ISO format
    clean_str = dt_str.replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(clean_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (ValueError, TypeError):
        return None


def handle_subscription_event(
    db: Session,
    event_type: str,
    data: dict[str, Any],
) -> Optional[Subscription]:
    """
    Handle a subscription event in a provider-neutral way.

    - subscription.created / subscription.active:
      Map to Pro plan, set tenant subscription_status = 'active', upsert Subscription row.
    - subscription.updated:
      Sync status, cancel_at_period_end, current_period_end. If status is past_due/unpaid,
      mark tenant.subscription_status = 'past_due'.
    - subscription.canceled:
      Subscription remains Pro until current_period_end; set cancel_at_period_end = True.
    - subscription.revoked:
      Immediate revocation / churn: revert tenant to Free plan, set status = 'canceled'.
    """
    sub_id = data.get("id")
    if not sub_id:
        return None

    # Resolve tenant_id: check metadata or customer external_id
    metadata = data.get("metadata") or {}
    customer = data.get("customer") or {}
    customer_metadata = customer.get("metadata") or {}

    tenant_id_str = (
        metadata.get("tenant_id")
        or customer.get("external_id")
        or customer_metadata.get("tenant_id")
    )

    # Provider status & timestamps
    provider_status = data.get("status")
    cancel_at_period_end = bool(data.get("cancel_at_period_end", False))
    current_period_end = parse_iso_datetime(data.get("current_period_end"))
    customer_id = data.get("customer_id") or customer.get("id")

    # Fetch plans
    pro_plan = db.query(Plan).filter(Plan.name == "pro").first()
    free_plan = db.query(Plan).filter(Plan.name == "free").first()

    # Look up existing subscription row
    sub_row = (
        db.query(Subscription)
        .filter(Subscription.provider_subscription_id == str(sub_id))
        .first()
    )

    # Resolve tenant
    tenant: Optional[Tenant] = None
    if sub_row:
        tenant = db.query(Tenant).filter(Tenant.id == sub_row.tenant_id).first()

    if not tenant and tenant_id_str:
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id_str).first()

    if not tenant and customer_id:
        tenant = db.query(Tenant).filter(Tenant.provider_customer_id == str(customer_id)).first()

    if not tenant:
        # Tenant cannot be found; nothing to sync to
        return None

    # Update provider_customer_id if available
    if customer_id and not tenant.provider_customer_id:
        tenant.provider_customer_id = str(customer_id)

    # ── Process based on event_type ─────────────────────────────────────────
    if event_type in ("subscription.created", "subscription.active"):
        if pro_plan:
            tenant.plan_id = pro_plan.id
        tenant.subscription_status = "active"

        if not sub_row:
            sub_row = Subscription(
                tenant_id=tenant.id,
                provider_subscription_id=str(sub_id),
                status=provider_status or "active",
                cancel_at_period_end=cancel_at_period_end,
                current_period_end=current_period_end,
            )
            db.add(sub_row)
        else:
            sub_row.status = provider_status or "active"
            sub_row.cancel_at_period_end = cancel_at_period_end
            if current_period_end:
                sub_row.current_period_end = current_period_end

    elif event_type == "subscription.updated":
        # Map provider past_due or unpaid to internal 'past_due'
        if provider_status in ("past_due", "unpaid"):
            tenant.subscription_status = "past_due"
        elif provider_status == "active":
            tenant.subscription_status = "active"

        if not sub_row:
            sub_row = Subscription(
                tenant_id=tenant.id,
                provider_subscription_id=str(sub_id),
                status=provider_status or tenant.subscription_status,
                cancel_at_period_end=cancel_at_period_end,
                current_period_end=current_period_end,
            )
            db.add(sub_row)
        else:
            sub_row.status = provider_status or sub_row.status
            sub_row.cancel_at_period_end = cancel_at_period_end
            if current_period_end:
                sub_row.current_period_end = current_period_end

    elif event_type == "subscription.canceled":
        # Stays on Pro until period end, flag cancel_at_period_end
        if sub_row:
            sub_row.cancel_at_period_end = True
            if current_period_end:
                sub_row.current_period_end = current_period_end
        else:
            sub_row = Subscription(
                tenant_id=tenant.id,
                provider_subscription_id=str(sub_id),
                status="canceled",
                cancel_at_period_end=True,
                current_period_end=current_period_end,
            )
            db.add(sub_row)

    elif event_type == "subscription.revoked":
        # Immediate revocation -> back to free plan
        if free_plan:
            tenant.plan_id = free_plan.id
        tenant.subscription_status = "canceled"

        if sub_row:
            sub_row.status = "revoked"
        else:
            sub_row = Subscription(
                tenant_id=tenant.id,
                provider_subscription_id=str(sub_id),
                status="revoked",
                cancel_at_period_end=False,
                current_period_end=current_period_end,
            )
            db.add(sub_row)

    return sub_row
