"""
Quota enforcement with pessimistic row locking (SELECT … FOR UPDATE).

Boundary rule (from DESIGN.md):
  A request is allowed if used + requested <= limit for BOTH api_call and ai_tokens.
  All-or-nothing: if either dimension exceeds its limit, nothing is recorded.

Status codes:
  - Free plan over quota  → 402 Payment Required
  - Pro plan over quota   → 429 Too Many Requests  + Retry-After header
  - Subscription past_due / canceled → 402 Payment Required
"""
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Plan, Tenant, UsageEvent
from app.services.metering import get_period_start


def get_current_usage(db: Session, tenant_id) -> dict:
    """Return current-month quantity totals for api_call and ai_tokens."""
    period_start = get_period_start()
    rows = (
        db.query(UsageEvent.usage_type, func.sum(UsageEvent.quantity))
        .filter(
            UsageEvent.tenant_id == tenant_id,
            UsageEvent.period_start == period_start,
        )
        .group_by(UsageEvent.usage_type)
        .all()
    )
    usage: dict[str, int] = {"api_call": 0, "ai_tokens": 0}
    for usage_type, total in rows:
        usage[usage_type] = int(total)
    return usage


def check_and_lock_quota(
    db: Session,
    tenant: Tenant,
    requested_calls: int,
    requested_tokens: int,
) -> dict:
    """
    Acquires a pessimistic FOR UPDATE lock on the tenant row, then checks
    both quota dimensions.  Returns the current usage dict on success.
    Raises HTTPException (402 or 429) if any limit is exceeded.
    """
    # Pessimistic lock — serialises concurrent requests for this tenant
    locked_tenant = (
        db.query(Tenant)
        .filter(Tenant.id == tenant.id)
        .with_for_update()
        .first()
    )
    plan: Plan = db.query(Plan).filter(Plan.id == locked_tenant.plan_id).first()

    # Guard: subscription health
    if locked_tenant.subscription_status in ("past_due", "canceled"):
        raise HTTPException(
            status_code=402,
            detail={
                "error": "payment_required",
                "message": (
                    f"Subscription is {locked_tenant.subscription_status}. "
                    "Please update your payment method."
                ),
            },
        )

    usage = get_current_usage(db, tenant.id)
    calls_used = usage["api_call"]
    tokens_used = usage["ai_tokens"]

    calls_ok = (calls_used + requested_calls) <= plan.api_calls_limit
    tokens_ok = (tokens_used + requested_tokens) <= plan.ai_tokens_limit

    if not calls_ok or not tokens_ok:
        # Report whichever limit is hit first
        if not calls_ok:
            used_val = calls_used
            limit_val = plan.api_calls_limit
            requested_val = requested_calls
            metric = "api_calls"
        else:
            used_val = tokens_used
            limit_val = plan.ai_tokens_limit
            requested_val = requested_tokens
            metric = "ai_tokens"

        detail = {
            "error": "quota_exceeded",
            "metric": metric,
            "used": used_val,
            "limit": limit_val,
            "requested": requested_val,
            "upgrade": (
                "Upgrade to Pro for higher limits."
                if plan.name == "free"
                else "You have reached your Pro plan limit."
            ),
        }

        if plan.name == "free":
            raise HTTPException(status_code=402, detail=detail)

        # Pro plan: 429 + Retry-After (seconds until next calendar month)
        now = datetime.now(timezone.utc)
        if now.month == 12:
            next_period = now.replace(
                year=now.year + 1, month=1, day=1,
                hour=0, minute=0, second=0, microsecond=0,
            )
        else:
            next_period = now.replace(
                month=now.month + 1, day=1,
                hour=0, minute=0, second=0, microsecond=0,
            )
        retry_after = max(0, int((next_period - now).total_seconds()))
        raise HTTPException(
            status_code=429,
            detail=detail,
            headers={"Retry-After": str(retry_after)},
        )

    return usage
