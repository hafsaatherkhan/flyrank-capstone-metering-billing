"""
GET /usage — returns the authenticated tenant's current-period usage rollup,
plan limits, subscription status, and cost breakdown (all values in micro-USD
except total_usd_display which is a human-readable string).
"""
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_tenant
from app.db import get_db
from app.models import Plan, Tenant, UsageEvent
from app.services.metering import get_period_start
from app.services.pricing import P_API_CALL, cost_for_tokens

router = APIRouter()


def _usd_display(micro_usd: int) -> str:
    """Format micro-USD integer as a human-readable USD string, e.g. '$1.234567'."""
    dollars = micro_usd / 1_000_000
    return f"${dollars:.6f}"


@router.get("/usage")
def get_usage(
    tenant: Tenant = Depends(get_tenant),
    db: Session = Depends(get_db),
):
    """
    Return current-period usage, limits, and cost breakdown for the tenant.

    Response shape:
    {
      "period": "2026-10",
      "plan": "free",
      "subscription_status": "active",
      "api_calls": {"used": 5, "limit": 1000},
      "ai_tokens": {"used": 12000, "limit": 100000},
      "cost": {
        "api_calls_micro_usd": 5000,
        "tokens_micro_usd": 12345,
        "total_micro_usd": 17345,
        "total_usd_display": "$0.017345"
      }
    }
    """
    period_start = get_period_start()
    plan: Plan = db.query(Plan).filter(Plan.id == tenant.plan_id).first()

    # Aggregate usage for this billing period in a single query
    rows = (
        db.query(
            UsageEvent.usage_type,
            func.sum(UsageEvent.quantity).label("qty"),
            func.sum(UsageEvent.cost_micro_usd).label("cost"),
        )
        .filter(
            UsageEvent.tenant_id == tenant.id,
            UsageEvent.period_start == period_start,
        )
        .group_by(UsageEvent.usage_type)
        .all()
    )

    calls_used: int = 0
    calls_cost: int = 0
    tokens_used: int = 0
    tokens_cost: int = 0

    for usage_type, qty, cost in rows:
        if usage_type == "api_call":
            calls_used = int(qty)
            calls_cost = int(cost)
        elif usage_type == "ai_tokens":
            tokens_used = int(qty)
            tokens_cost = int(cost)

    total_cost = calls_cost + tokens_cost
    period_label = period_start.strftime("%Y-%m")

    return {
        "period": period_label,
        "plan": plan.name,
        "subscription_status": tenant.subscription_status,
        "api_calls": {
            "used": calls_used,
            "limit": plan.api_calls_limit,
        },
        "ai_tokens": {
            "used": tokens_used,
            "limit": plan.ai_tokens_limit,
        },
        "cost": {
            "api_calls_micro_usd": calls_cost,
            "tokens_micro_usd": tokens_cost,
            "total_micro_usd": total_cost,
            "total_usd_display": _usd_display(total_cost),
        },
    }
