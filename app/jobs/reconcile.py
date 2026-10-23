"""
Subscription reconciliation job.

Compares local subscription status with Polar's live status via the API and
logs mismatches loudly. Does NOT auto-fix — only reports. This satisfies the
"background job" capstone requirement.

Run modes:
  1. CLI:            python -m app.jobs.reconcile
  2. Vercel Cron:    GET /api/cron/reconcile  (protected by Authorization: Bearer $CRON_SECRET)

Design notes:
  - Failures on individual subscriptions are caught and logged; the loop continues.
  - Secrets (access tokens, webhook secrets) are never logged.
  - Returns a structured JSON summary suitable for Vercel Cron's log viewer.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.config import settings
from app.db import SessionLocal
from app.models import Subscription, Tenant

logger = logging.getLogger(__name__)


# ── Polar SDK import (lazy, so import errors don't break startup) ─────────────
def _get_polar_client():
    """Return a configured Polar SDK client for the sandbox environment."""
    try:
        from polar.v2027_01 import Polar  # type: ignore
        return Polar(
            access_token=settings.polar_access_token,
            environment=settings.polar_server,
        )
    except Exception as exc:
        logger.error("Failed to initialise Polar client: %s", type(exc).__name__)
        return None


# ── Core reconciliation logic ─────────────────────────────────────────────────
def run_reconcile(db: Session) -> dict:
    """
    Fetch all subscriptions from the local DB, call Polar to get the live status
    for each one, and log any mismatch between local and provider state.

    Returns a summary dict with counts of checked / mismatched / errored rows.
    """
    logger.info("Reconciliation started at %s", datetime.now(timezone.utc).isoformat())

    client = _get_polar_client()
    if client is None:
        logger.error("Reconciliation aborted: Polar client unavailable.")
        return {"checked": 0, "mismatched": 0, "errored": 0, "aborted": True}

    subscriptions: list[Subscription] = db.query(Subscription).all()
    checked = 0
    mismatched = 0
    errored = 0

    for sub in subscriptions:
        try:
            checked += 1
            provider_sub = client.subscriptions.get(sub.provider_subscription_id)
            provider_status: Optional[str] = getattr(provider_sub, "status", None)

            # Fetch the associated tenant for context (no secret data logged)
            tenant: Optional[Tenant] = db.query(Tenant).filter(
                Tenant.id == sub.tenant_id
            ).first()
            tenant_label = str(sub.tenant_id)[:8]  # First 8 chars of UUID only

            if provider_status and provider_status != sub.status:
                mismatched += 1
                logger.warning(
                    "MISMATCH tenant=%s sub=%s local_status=%s provider_status=%s",
                    tenant_label,
                    sub.provider_subscription_id,
                    sub.status,
                    provider_status,
                )
            else:
                logger.info(
                    "OK tenant=%s sub=%s status=%s",
                    tenant_label,
                    sub.provider_subscription_id,
                    sub.status,
                )

        except Exception as exc:
            errored += 1
            # Log the exception type but never the full response which might include tokens
            logger.error(
                "Error checking sub=%s error_type=%s",
                sub.provider_subscription_id,
                type(exc).__name__,
            )

    logger.info(
        "Reconciliation complete: checked=%d mismatched=%d errored=%d",
        checked,
        mismatched,
        errored,
    )
    return {"checked": checked, "mismatched": mismatched, "errored": errored, "aborted": False}


# ── CLI entry point ───────────────────────────────────────────────────────────
def main() -> None:
    """Entry point for `python -m app.jobs.reconcile`."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    db = SessionLocal()
    try:
        summary = run_reconcile(db)
        print(summary)
    finally:
        db.close()


if __name__ == "__main__":
    main()
