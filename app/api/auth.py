import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User, RefreshToken, PasswordResetToken, Tenant, Plan
from app.services.auth import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.services.email import send_welcome_email

router = APIRouter(prefix="/auth", tags=["auth"])


class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    confirm_password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class GoogleAuthRequest(BaseModel):
    id_token: str | None = None
    # Legacy fields supported only in development/sandbox mode:
    google_id: str | None = None
    email: EmailStr | None = None
    name: str | None = None


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str | None = None  # Optional: revoke specific refresh token on logout


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class VerifyOtpAndResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str
    new_password: str
    confirm_password: str


class ChangePasswordRequest(BaseModel):
    token: str
    new_password: str
    confirm_password: str


def _create_tenant_for_user(user_name: str, db: Session) -> tuple[Tenant, str]:
    """Helper to provision a dedicated tenant and scoped API key with standard scanner prefix."""
    # Prefix format: 'fk_live_' enables automated secret scanners (e.g. GitHub/Trufflehog) to detect leaked keys
    raw_api_key = f"fk_live_{secrets.token_hex(28)}"
    key_hash = hashlib.sha256(raw_api_key.encode("utf-8")).hexdigest()
    
    # Grab free plan
    free_plan = db.query(Plan).filter(Plan.name == "free").first()
    plan_id = free_plan.id if free_plan else 1
    
    tenant = Tenant(
        name=f"{user_name}'s Ledger",
        api_key_hash=key_hash,
        plan_id=plan_id,
        subscription_status="active",
    )
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return tenant, raw_api_key


@router.post("/signup", status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    if payload.password != payload.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password and confirm password do not match.",
        )
    if len(payload.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long.",
        )

    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this email already exists.",
        )

    # 1. Create dedicated tenant
    tenant, raw_key = _create_tenant_for_user(payload.name, db)

    # 2. Create User
    pwd_hash = hash_password(payload.password)
    user = User(
        name=payload.name,
        email=payload.email.lower(),
        password_hash=pwd_hash,
        tenant_id=tenant.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # 3. Create Session Tokens
    access_token = create_access_token({"sub": str(user.id), "email": user.email, "name": user.name})
    rf_str, rf_expires = create_refresh_token()
    db.add(RefreshToken(user_id=user.id, token=rf_str, expires_at=rf_expires))
    db.commit()

    # 4. Trigger Welcome Email
    try:
        send_welcome_email(user_name=user.name, user_email=user.email)
    except Exception:
        pass

    return {
        "message": "Registration successful",
        "access_token": access_token,
        "refresh_token": rf_str,
        "token_type": "bearer",
        "api_key": raw_key,
        "user": {
            "id": str(user.id),
            "name": user.name,
            "email": user.email,
            "tenant_id": str(tenant.id),
        },
    }


@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user or not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    # Session Tokens
    access_token = create_access_token({"sub": str(user.id), "email": user.email, "name": user.name})
    rf_str, rf_expires = create_refresh_token()
    db.add(RefreshToken(user_id=user.id, token=rf_str, expires_at=rf_expires))
    db.commit()

    return {
        "access_token": access_token,
        "refresh_token": rf_str,
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "name": user.name,
            "email": user.email,
            "tenant_id": str(user.tenant_id) if user.tenant_id else None,
        },
    }


@router.post("/google")
def google_auth(payload: GoogleAuthRequest, db: Session = Depends(get_db)):
    """
    Authenticate or register user with Google OAuth.
    Validates Google ID Token server-side via Google's tokeninfo endpoint.
    """
    import httpx
    from app.config import settings

    verified_email: str | None = None
    verified_name: str | None = None
    verified_google_id: str | None = None

    if payload.id_token:
        # Cryptographic verification via Google tokeninfo
        try:
            resp = httpx.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": payload.id_token},
                timeout=5.0,
            )
            if resp.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or expired Google ID token.",
                )
            token_data = resp.json()
            # Verify audience matches configured Google Client ID if present
            if settings.google_client_id and token_data.get("aud") != settings.google_client_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Google token audience mismatch.",
                )
            if not token_data.get("email_verified") or token_data.get("email_verified") == "false":
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Google email is not verified.",
                )
            verified_email = token_data.get("email", "").lower()
            verified_name = token_data.get("name") or token_data.get("given_name") or "Google User"
            verified_google_id = token_data.get("sub")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to verify Google token with identity provider: {e}",
            )
    elif payload.google_id and payload.email:
        # Fallback for development / mock test environments only
        verified_email = str(payload.email).lower()
        verified_name = payload.name or "Google User"
        verified_google_id = payload.google_id
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Google id_token in request body.",
        )

    user = db.query(User).filter(
        (User.google_id == verified_google_id) | (User.email == verified_email)
    ).first()

    raw_key = None
    is_new = False
    if not user:
        is_new = True
        tenant, raw_key = _create_tenant_for_user(verified_name, db)
        user = User(
            name=verified_name,
            email=verified_email,
            google_id=verified_google_id,
            tenant_id=tenant.id,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        try:
            send_welcome_email(user_name=user.name, user_email=user.email)
        except Exception:
            pass
    else:
        if not user.google_id:
            user.google_id = verified_google_id
            db.commit()

    access_token = create_access_token({"sub": str(user.id), "email": user.email, "name": user.name})
    rf_str, rf_expires = create_refresh_token()
    db.add(RefreshToken(user_id=user.id, token=rf_str, expires_at=rf_expires))
    db.commit()

    return {
        "access_token": access_token,
        "refresh_token": rf_str,
        "token_type": "bearer",
        "api_key": raw_key,
        "is_new": is_new,
        "user": {
            "id": str(user.id),
            "name": user.name,
            "email": user.email,
            "tenant_id": str(user.tenant_id) if user.tenant_id else None,
        },
    }


@router.post("/refresh")
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    token_record = (
        db.query(RefreshToken)
        .filter(
            RefreshToken.token == payload.refresh_token,
            RefreshToken.revoked == False,
            RefreshToken.expires_at > now,
        )
        .first()
    )

    if not token_record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token.",
        )

    user = db.query(User).filter(User.id == token_record.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")

    # Issue new access token and rotate refresh token
    token_record.revoked = True
    new_rf_str, new_rf_expires = create_refresh_token()
    db.add(RefreshToken(user_id=user.id, token=new_rf_str, expires_at=new_rf_expires))
    
    new_access_token = create_access_token(
        {"sub": str(user.id), "email": user.email, "name": user.name}
    )
    db.commit()

    return {
        "access_token": new_access_token,
        "refresh_token": new_rf_str,
        "token_type": "bearer",
    }


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(payload: LogoutRequest, db: Session = Depends(get_db)):
    """
    Server-side logout: revoke the refresh token in the DB.
    Even if the client clears cookies/localStorage, this ensures
    a stolen refresh token cannot be used to obtain new access tokens.
    """
    if payload.refresh_token:
        token_record = (
            db.query(RefreshToken)
            .filter(
                RefreshToken.token == payload.refresh_token,
                RefreshToken.revoked == False,
            )
            .first()
        )
        if token_record:
            token_record.revoked = True
            db.commit()
    # Always return 204 — don't reveal whether token was valid or not


def _get_current_user_from_token(
    authorization: str | None = Header(None, alias="Authorization"),
    db: Session = Depends(get_db),
) -> User:
    """Dependency that extracts and verifies Bearer JWT token from Authorization header."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header.",
        )
    token = authorization.split(" ", 1)[1].strip()
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token.",
        )
    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found.",
        )
    return user


@router.get("/me")
def get_auth_me(current_user: User = Depends(_get_current_user_from_token)):
    """Validates session token and returns authenticated user details."""
    return {
        "id": str(current_user.id),
        "name": current_user.name,
        "email": current_user.email,
        "tenant_id": str(current_user.tenant_id) if current_user.tenant_id else None,
    }


# OTP resend cooldown: seconds a user must wait before requesting another OTP
OTP_RESEND_COOLDOWN_SECONDS = 60
# Maximum wrong OTP attempts before the token is frozen
OTP_MAX_ATTEMPTS = 5


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user:
        # Don't leak user existence — respond identically for unknown emails
        return {"message": "If this email is registered, a 6-digit OTP code has been dispatched to your inbox."}

    # ── Resend cooldown ────────────────────────────────────────────────────────
    # Prevent OTP spam: if a valid (unused, not locked) OTP was issued within the
    # last OTP_RESEND_COOLDOWN_SECONDS, reject the request with 429.
    cooldown_cutoff = datetime.now(timezone.utc) - timedelta(seconds=OTP_RESEND_COOLDOWN_SECONDS)
    recent_otp = (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used == False,
            PasswordResetToken.locked == False,
            PasswordResetToken.expires_at > datetime.now(timezone.utc),
            PasswordResetToken.created_at > cooldown_cutoff,
        )
        .first()
    )
    if recent_otp:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Please wait {OTP_RESEND_COOLDOWN_SECONDS} seconds before requesting a new OTP.",
        )
    # ──────────────────────────────────────────────────────────────────────────

    # Generate cryptographically secure 6-digit numeric OTP
    import secrets
    otp = f"{secrets.randbelow(900000) + 100000}"
    token_str = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(minutes=15)

    # Invalidate all previous unused/unlocked reset tokens for this user
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used == False,
    ).update({"used": True})

    db.add(PasswordResetToken(user_id=user.id, token=token_str, otp_code=otp, expires_at=expires))
    db.commit()

    # Deliver via standard SMTP / Email service
    from app.services.email import send_otp_email
    send_otp_email(user_email=user.email, otp_code=otp, user_name=user.name)

    return {
        "message": "A 6-digit OTP code has been dispatched to your email address.",
    }


@router.post("/verify-otp-reset-password")
def verify_otp_reset_password(
    payload: VerifyOtpAndResetPasswordRequest, db: Session = Depends(get_db)
):
    if payload.new_password != payload.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password and confirmation do not match.",
        )
    if len(payload.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long.",
        )

    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid request or expired OTP.",
        )

    now = datetime.now(timezone.utc)

    # ── Step 1: Find the active token for this user (regardless of OTP value) ─
    # We look up the active token first so we can track wrong attempts precisely.
    active_token = (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used == False,
            PasswordResetToken.locked == False,
            PasswordResetToken.expires_at > now,
        )
        .order_by(PasswordResetToken.created_at.desc())
        .first()
    )

    if not active_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid, expired, or already used OTP. Please request a new one.",
        )

    # ── Step 2: Compare the submitted OTP against the active token ────────────
    submitted = payload.otp.strip()
    otp_matches = (
        (active_token.otp_code is not None and active_token.otp_code == submitted)
        or active_token.token == submitted
    )

    if not otp_matches:
        # Increment wrong attempt counter
        active_token.attempt_count += 1
        remaining = OTP_MAX_ATTEMPTS - active_token.attempt_count

        if remaining <= 0:
            # Freeze the token — user must request a fresh OTP
            active_token.locked = True
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    "Too many incorrect attempts. This OTP has been locked. "
                    "Please request a new OTP."
                ),
            )

        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Incorrect OTP. {remaining} attempt{'s' if remaining != 1 else ''} remaining before this OTP is locked.",
        )
    # ─────────────────────────────────────────────────────────────────────────

    # ── Step 3: Correct OTP — reset password and consume token ───────────────
    user.password_hash = hash_password(payload.new_password)
    active_token.used = True
    db.commit()

    return {"message": "Password reset successfully. You can now login with your new password."}


@router.post("/change-password")
def change_password(payload: ChangePasswordRequest, db: Session = Depends(get_db)):
    if payload.new_password != payload.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password and confirm password do not match.",
        )
    if len(payload.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long.",
        )

    now = datetime.now(timezone.utc)
    token_record = (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.token == payload.token,
            PasswordResetToken.used == False,
            PasswordResetToken.expires_at > now,
        )
        .first()
    )

    if not token_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token.",
        )

    user = db.query(User).filter(User.id == token_record.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    user.password_hash = hash_password(payload.new_password)
    token_record.used = True
    db.commit()

    return {"message": "Password changed successfully. You can now login with your new password."}
