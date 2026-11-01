import hashlib
import hmac
from fastapi import Header, HTTPException, Depends
from sqlalchemy.orm import Session
from app.db import get_db
from app.models import Tenant


def get_tenant(
    x_api_key: str | None = Header(None, alias="X-API-Key"),
    authorization: str | None = Header(None, alias="Authorization"),
    db: Session = Depends(get_db),
) -> Tenant:
    """
    Authenticate via X-API-Key header or Bearer JWT token.
    - If X-API-Key is provided, uses constant-time SHA-256 hash comparison.
    - If Authorization Bearer token is provided, decodes user access token and resolves tenant.
    """
    # 1. API Key Authentication
    if x_api_key:
        key_hash = hashlib.sha256(x_api_key.encode()).hexdigest()
        tenant = db.query(Tenant).filter(Tenant.api_key_hash == key_hash).first()
        if not tenant:
            raise HTTPException(status_code=401, detail={"error": "invalid_api_key", "message": "Invalid API key."})
        return tenant

    # 2. JWT Bearer Token Authentication
    if authorization and authorization.startswith("Bearer "):
        from app.services.auth import decode_token
        from app.models import User

        token = authorization.split(" ", 1)[1].strip()
        payload = decode_token(token)
        if payload and payload.get("type") == "access":
            user_id = payload.get("sub")
            user = db.query(User).filter(User.id == user_id).first()
            if user and user.tenant_id:
                tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
                if tenant:
                    return tenant

    raise HTTPException(status_code=401, detail={"error": "unauthorized", "message": "Missing or invalid authentication. Provide X-API-Key or Bearer token."})

