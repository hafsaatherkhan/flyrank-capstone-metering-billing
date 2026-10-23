"""
GET /api/cron/reconcile — Vercel Cron endpoint that runs the reconciliation job.

Protected by Authorization: Bearer $CRON_SECRET.
Vercel Cron sends this header automatically on production deployments.
The route is also callable manually for ad-hoc checks.
"""
import logging

from fastapi import APIRouter, Header, HTTPException, status, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.jobs.reconcile import run_reconcile

logger = logging.getLogger(__name__)
router = APIRouter()


def _verify_cron_secret(authorization: str = Header(..., alias="Authorization")) -> None:
    """
    Validates 'Authorization: Bearer <CRON_SECRET>' header.
    Raises 403 on mismatch so the endpoint is never publicly callable without the secret.
    """
    expected = f"Bearer {settings.cron_secret}"
    # Use constant-time comparison to prevent timing attacks
    import hmac
    if not hmac.compare_digest(authorization, expected):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "forbidden", "message": "Invalid cron secret."},
        )


@router.get("/api/cron/reconcile")
def cron_reconcile(
    _: None = Depends(_verify_cron_secret),
    db: Session = Depends(get_db),
):
    """
    Vercel Cron endpoint: compare local subscription state with Polar's live state.
    Logs mismatches; does not auto-fix anything.
    Returns a JSON summary: {checked, mismatched, errored, aborted}.
    """
    logger.info("Cron reconcile triggered via HTTP")
    try:
        summary = run_reconcile(db)
        return JSONResponse(status_code=200, content={"status": "ok", **summary})
    except Exception as exc:
        logger.error("Reconciliation job crashed: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "reconcile_failed", "message": "Job encountered an unexpected error."},
        )
