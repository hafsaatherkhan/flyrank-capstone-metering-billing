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


from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Query, status, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db, SessionLocal
from app.jobs.reconcile import run_reconcile
from app.models import Tenant

logger = logging.getLogger(__name__)
router = APIRouter()


def _verify_cron_or_tenant(
    authorization: str | None = Header(None, alias="Authorization"),
    x_api_key: str | None = Header(None, alias="X-API-Key"),
    db: Session = Depends(get_db),
) -> None:
    """
    Validates either:
    1. 'Authorization: Bearer <CRON_SECRET>' (for automated Vercel Cron / external scheduler)
    2. 'X-API-Key: <valid_tenant_key>' (for authenticated UI playground / dashboard triggers)
    
    Raises 403 on invalid cron secret and 401 on invalid/missing API key.
    """
    import hmac
    import hashlib

    # Case 1: Check Authorization header for Cron Secret
    if authorization:
        expected = f"Bearer {settings.cron_secret}"
        if hmac.compare_digest(authorization, expected):
            return
        # If an Authorization Bearer token is provided but doesn't match cron_secret,
        # check if it might be an X-API-Key fallback or reject
        if not x_api_key:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": "forbidden", "message": "Invalid cron secret."},
            )

    # Case 2: Check X-API-Key header (Tenant authentication for secure UI trigger)
    if x_api_key:
        key_hash = hashlib.sha256(x_api_key.encode()).hexdigest()
        tenant = db.query(Tenant).filter(Tenant.api_key_hash == key_hash).first()
        if tenant:
            return
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "invalid_api_key", "message": "Invalid API key."},
        )

    # Neither valid cron secret nor valid API key provided
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={"error": "forbidden", "message": "Missing or invalid authorization."},
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
    _: None = Depends(_verify_cron_or_tenant),
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
