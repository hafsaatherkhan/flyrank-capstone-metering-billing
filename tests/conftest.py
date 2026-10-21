"""
Shared fixtures and helpers for the test suite.
Uses the Neon `test` branch database (DATABASE_URL_TEST).
Tables are created once per session and wiped between each test.
"""
import hashlib
import os
import secrets

import pytest
from dotenv import load_dotenv
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

load_dotenv()

TEST_DATABASE_URL = os.environ["DATABASE_URL_TEST"]

# ── Test engine (NullPool, test branch) ──────────────────────────────────────
engine_test = create_engine(
    TEST_DATABASE_URL,
    poolclass=NullPool,
    connect_args={"connect_timeout": 30},
)
TestingSessionLocal = sessionmaker(bind=engine_test, autocommit=False, autoflush=False)

# ── Import app pieces AFTER env is loaded ────────────────────────────────────
from app.db import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import (  # noqa: E402
    IdempotencyKey,
    Plan,
    Subscription,
    Tenant,
    UsageEvent,
)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


# ── Session-scoped: create all tables once ───────────────────────────────────
@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=engine_test)
    yield
    Base.metadata.drop_all(bind=engine_test)


# ── Function-scoped: wipe tables between every test (single round-trip) ──────
@pytest.fixture(autouse=True)
def clean_tables():
    db = TestingSessionLocal()
    db.execute(text(
        "TRUNCATE TABLE usage_events, idempotency_keys, subscriptions, webhook_events, tenants, plans RESTART IDENTITY CASCADE"
    ))
    db.commit()
    db.close()



# ── Convenience DB session ────────────────────────────────────────────────────
@pytest.fixture
def db():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


# ── TestClient ────────────────────────────────────────────────────────────────
@pytest.fixture
def client():
    return TestClient(app)


# ── Factory helpers ───────────────────────────────────────────────────────────
def make_plan(
    db,
    name: str = "free",
    api_calls_limit: int = 1_000,
    ai_tokens_limit: int = 100_000,
) -> Plan:
    plan = Plan(name=name, api_calls_limit=api_calls_limit, ai_tokens_limit=ai_tokens_limit)
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


def make_tenant(
    db,
    plan_id: int,
    name: str = "Test Tenant",
    subscription_status: str = "active",
) -> tuple[Tenant, str]:
    raw_key = secrets.token_hex(32)
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    tenant = Tenant(
        name=name,
        api_key_hash=key_hash,
        plan_id=plan_id,
        subscription_status=subscription_status,
    )
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return tenant, raw_key


# ── Composite fixtures ────────────────────────────────────────────────────────
@pytest.fixture
def free_tenant(db):
    plan = make_plan(db)
    tenant, raw_key = make_tenant(db, plan.id)
    return tenant, raw_key, plan


@pytest.fixture
def pro_tenant(db):
    plan = make_plan(db, name="pro", api_calls_limit=50_000, ai_tokens_limit=5_000_000)
    tenant, raw_key = make_tenant(db, plan.id)
    return tenant, raw_key, plan
