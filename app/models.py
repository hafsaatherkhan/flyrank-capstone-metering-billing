import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    BigInteger, Boolean, Column, DateTime, ForeignKey,
    Integer, String, UniqueConstraint, Index, text
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from app.db import Base


def utcnow():
    return datetime.now(timezone.utc)


class Plan(Base):
    __tablename__ = "plans"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False, unique=True)
    api_calls_limit = Column(Integer, nullable=False)
    ai_tokens_limit = Column(Integer, nullable=False)
    provider_product_id = Column(String, nullable=True)


class Tenant(Base):
    __tablename__ = "tenants"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    api_key_hash = Column(String(64), nullable=False, unique=True)
    plan_id = Column(Integer, ForeignKey("plans.id"), nullable=False)
    subscription_status = Column(String, nullable=False, default="active")
    provider_customer_id = Column(String, nullable=True, unique=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)


class Subscription(Base):
    __tablename__ = "subscriptions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    provider_subscription_id = Column(String, nullable=False, unique=True)
    status = Column(String, nullable=False)
    cancel_at_period_end = Column(Boolean, nullable=False, default=False)
    current_period_end = Column(DateTime(timezone=True), nullable=True)
    __table_args__ = (
        Index("ix_subscriptions_tenant_id", "tenant_id"),
    )


class IdempotencyKey(Base):
    __tablename__ = "idempotency_keys"
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, primary_key=True)
    key = Column(String, nullable=False, primary_key=True)
    request_hash = Column(String(64), nullable=False)
    response_status = Column(Integer, nullable=False)
    response_body = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)


class UsageEvent(Base):
    __tablename__ = "usage_events"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    usage_type = Column(String, nullable=False)  # 'api_call' | 'ai_tokens'
    quantity = Column(Integer, nullable=False)
    input_tokens = Column(Integer, nullable=False, default=0)
    cached_input_tokens = Column(Integer, nullable=False, default=0)
    output_tokens = Column(Integer, nullable=False, default=0)
    reasoning_tokens = Column(Integer, nullable=False, default=0)
    cost_micro_usd = Column(BigInteger, nullable=False)
    idempotency_key = Column(String, nullable=False)
    period_start = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    __table_args__ = (
        UniqueConstraint("tenant_id", "idempotency_key", "usage_type", name="uq_usage_events_tenant_ikey_type"),
        Index("ix_usage_events_tenant_period_type", "tenant_id", "period_start", "usage_type"),
    )


class WebhookEvent(Base):
    __tablename__ = "webhook_events"
    event_id = Column(String, primary_key=True)  # the webhook-id header
    type = Column(String, nullable=False)
    received_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    processed_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)


class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False, unique=True, index=True)
    password_hash = Column(String, nullable=True)  # nullable for OAuth users
    google_id = Column(String, nullable=True, unique=True, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=True)
    api_key = Column(String, nullable=True)  # Plain text display key returned once / available in session
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    token = Column(String, nullable=False, unique=True, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    token = Column(String, nullable=False, unique=True, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
