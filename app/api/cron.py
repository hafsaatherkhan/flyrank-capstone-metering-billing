"""
GET /api/cron/reconcile — Vercel Cron endpoint that runs the reconciliation job.

Protected by Authorization: Bearer $CRON_SECRET.
Vercel Cron sends this header automatically on production deployments.
The route is also callable manually for ad-hoc checks.
"""
import logging

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Query, status, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db, SessionLocal
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


def _run_reconcile_background() -> None:
    """Background task runner opening its own isolated database session."""
    db = SessionLocal()
    try:
        run_reconcile(db)
    except Exception as exc:
        logger.error("Background reconciliation task encountered error: %s", type(exc).__name__)
    finally:
        db.close()


@router.get("/api/cron/reconcile")
def cron_reconcile(
    background_tasks: BackgroundTasks,
    sync: bool = Query(default=True, description="When false, runs task asynchronously off the request path"),
    _: None = Depends(_verify_cron_secret),
    db: Session = Depends(get_db),
):
    """
    Vercel Cron endpoint: compare local subscription state with Polar's live state.
    Logs mismatches; does not auto-fix anything.
    
    If sync=true (default for Vercel Cron to collect response): runs and returns summary.
    If sync=false: enqueues background worker task off the request path and returns 202 Accepted.
    """
    logger.info("Cron reconcile triggered via HTTP (sync=%s)", sync)
    if not sync:
        background_tasks.add_task(_run_reconcile_background)
        return JSONResponse(
            status_code=status.HTTP_202_ACCEPTED,
            content={"status": "accepted", "message": "Reconciliation job enqueued in background."},
        )

    try:
        summary = run_reconcile(db)
        return JSONResponse(status_code=200, content={"status": "ok", **summary})
    except Exception as exc:
        logger.error("Reconciliation job crashed: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "reconcile_failed", "message": "Job encountered an unexpected error."},
        )
