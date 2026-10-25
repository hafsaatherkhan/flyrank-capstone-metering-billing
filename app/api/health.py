from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.db import get_db

router = APIRouter(tags=["health"])


@router.get("/healthz")
def liveness():
    """Liveness probe: verifies process is alive and receiving HTTP traffic."""
    return {"status": "ok"}


@router.get("/ready")
@router.get("/health")
def readiness(db: Session = Depends(get_db)):
    """Readiness probe: verifies database connectivity and pool responsiveness."""
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as exc:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "degraded", "database": "unreachable", "error": str(type(exc).__name__)},
        )
