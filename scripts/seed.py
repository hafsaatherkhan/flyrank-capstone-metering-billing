"""
Seed script: creates plans (free/pro) and 2 demo tenants.
Idempotent: safe to re-run. Prints API keys on first creation only.
Run: python scripts/seed.py
"""
import hashlib
import os
import secrets
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db import SessionLocal
from app.models import Plan, Tenant

PLANS = [
    {"name": "free", "api_calls_limit": 1_000, "ai_tokens_limit": 100_000, "stripe_price_id": None},
    {"name": "pro", "api_calls_limit": 50_000, "ai_tokens_limit": 5_000_000, "stripe_price_id": os.getenv("STRIPE_PRO_PRICE_ID")},
]

TENANTS = [
    {"name": "Tenant A (Demo)"},
    {"name": "Tenant B (Demo)"},
]


def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def seed():
    db = SessionLocal()
    try:
        # Upsert plans
        for plan_data in PLANS:
            existing = db.query(Plan).filter_by(name=plan_data["name"]).first()
            if not existing:
                db.add(Plan(**plan_data))
        db.commit()
        print("Plans seeded.")

        free_plan = db.query(Plan).filter_by(name="free").first()

        # Create demo tenants (idempotent by name)
        for tenant_data in TENANTS:
            existing = db.query(Tenant).filter_by(name=tenant_data["name"]).first()
            if not existing:
                raw_key = secrets.token_hex(32)
                tenant = Tenant(
                    name=tenant_data["name"],
                    api_key_hash=sha256_hex(raw_key),
                    plan_id=free_plan.id,
                    subscription_status="active",
                )
                db.add(tenant)
                db.commit()
                db.refresh(tenant)
                print(f"Created tenant: {tenant.name}")
                print(f"  API Key (save this, shown once): {raw_key}")
                print(f"  Tenant ID: {tenant.id}")
            else:
                print(f"Tenant '{tenant_data['name']}' already exists, skipping.")
        print("Seed complete.")
    finally:
        db.close()


if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    seed()
