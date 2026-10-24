import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
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
    google_id: str
    email: EmailStr
    name: str


class RefreshRequest(BaseModel):
    refresh_token: str


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
    """Helper to provision a dedicated tenant and API key for a registered user."""
    raw_api_key = secrets.token_hex(32)
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
        api_key=raw_key,
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
        "api_key": user.api_key,
        "user": {
            "id": str(user.id),
            "name": user.name,
            "email": user.email,
            "tenant_id": str(user.tenant_id) if user.tenant_id else None,
        },
    }


@router.post("/google")
def google_auth(payload: GoogleAuthRequest, db: Session = Depends(get_db)):
    """Authenticate or register user with Google OAuth."""
    user = db.query(User).filter(
        (User.google_id == payload.google_id) | (User.email == payload.email.lower())
    ).first()

    raw_key = None
    is_new = False
    if not user:
        is_new = True
        tenant, raw_key = _create_tenant_for_user(payload.name, db)
        user = User(
            name=payload.name,
            email=payload.email.lower(),
            google_id=payload.google_id,
            tenant_id=tenant.id,
            api_key=raw_key,
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
            user.google_id = payload.google_id
            db.commit()
        raw_key = user.api_key

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


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user:
        # Don't leak user existence
        return {"message": "If this email is registered, a 6-digit OTP code has been dispatched to your inbox."}

    # Generate cryptographically secure 6-digit numeric OTP
    import secrets
    otp = f"{secrets.randbelow(900000) + 100000}"
    token_str = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(minutes=15)

    # Invalidate previous unused reset tokens for this user
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
    token_record = (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.user_id == user.id,
            (PasswordResetToken.otp_code == payload.otp.strip()) | (PasswordResetToken.token == payload.otp.strip()),
            PasswordResetToken.used == False,
            PasswordResetToken.expires_at > now,
        )
        .first()
    )

    if not token_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid, expired, or already used 6-digit OTP code.",
        )

    # Update password and consume OTP
    user.password_hash = hash_password(payload.new_password)
    token_record.used = True
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
