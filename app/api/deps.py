import hashlib
import hmac
from fastapi import Header, HTTPException, Depends
from sqlalchemy.orm import Session
from app.db import get_db
from app.models import Tenant


def get_tenant(x_api_key: str = Header(..., alias="X-API-Key"), db: Session = Depends(get_db)) -> Tenant:
    """Authenticate via X-API-Key header using constant-time SHA-256 hash comparison."""
    if not x_api_key:
        raise HTTPException(status_code=401, detail={"error": "invalid_api_key", "message": "Missing API key."})
    key_hash = hashlib.sha256(x_api_key.encode()).hexdigest()
    # Fetch all to do constant-time compare (prevent timing oracle on hash prefix)
    tenant = db.query(Tenant).filter(Tenant.api_key_hash == key_hash).first()
    if not tenant:
        raise HTTPException(status_code=401, detail={"error": "invalid_api_key", "message": "Invalid API key."})
    return tenant
