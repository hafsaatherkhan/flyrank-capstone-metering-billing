"""
GET /api/cron/reconcile — Vercel Cron endpoint that runs the reconciliation job.

Protected by Authorization: Bearer $CRON_SECRET.
Vercel Cron sends this header automatically on production deployments.
The route is also callable manually for ad-hoc checks.
"""
import hmac
import logging

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.db import SessionLocal, get_db
from app.jobs.reconcile import run_reconcile
from app.models import Tenant, User
from app.services.auth import decode_token

logger = logging.getLogger(__name__)
router = APIRouter()


def _verify_cron_or_user(
    authorization: str | None = Header(None, alias="Authorization"),
    x_api_key: str | None = Header(None, alias="X-API-Key"),
    db: Session = Depends(get_db),
) -> None:
    """
    Validates either:
    1. 'Authorization: Bearer <CRON_SECRET>' (for automated Vercel Cron jobs)
    2. A valid logged-in user JWT bearer token or API key (from frontend dashboard)
    
    Raises 403/401 on invalid or missing authorization.
    """
    if not authorization and not x_api_key:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "forbidden", "message": "Missing authorization header."},
        )

    # 1. Check CRON_SECRET match (for Vercel Cron)
    if authorization and settings.cron_secret:
        expected = f"Bearer {settings.cron_secret}"
        if hmac.compare_digest(authorization, expected):
            return

    # 2. Check logged-in user JWT token
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
        payload = decode_token(token)
        if payload and payload.get("type") == "access":
            user_id = payload.get("sub")
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                return

    # 3. Check X-API-Key
    if x_api_key:
        import hashlib
        key_hash = hashlib.sha256(x_api_key.encode()).hexdigest()
        tenant = db.query(Tenant).filter(Tenant.api_key_hash == key_hash).first()
        if tenant:
            return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={"error": "forbidden", "message": "Invalid authorization or cron secret."},
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
    _: None = Depends(_verify_cron_or_user),
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
