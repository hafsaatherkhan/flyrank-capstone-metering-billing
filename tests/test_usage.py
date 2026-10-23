"""
Phase 4 tests for GET /usage endpoint:
- Returns correct period, plan, subscription_status, limits.
- Aggregates api_call and ai_tokens correctly.
- Cost fields use summed micro-USD from stored events.
- Unauthenticated request → 401.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models import UsageEvent
from app.services.metering import get_period_start
from app.services.pricing import cost_for_api_call, cost_for_tokens
from tests.conftest import TestingSessionLocal, make_plan, make_tenant

client = TestClient(app)


def get_usage(api_key: str):
    return client.get("/usage", headers={"X-API-Key": api_key})


class TestUsageEndpoint:
    def test_unauthenticated_returns_401(self):
        r = client.get("/usage")
        # No X-API-Key → FastAPI validates missing required Header as 422
        # But our dep raises 401 when key is present but invalid.
        # Missing header = 422 per FastAPI.
        assert r.status_code in (401, 422)

    def test_invalid_api_key_returns_401(self):
        r = client.get("/usage", headers={"X-API-Key": "totally-bogus-key"})
        assert r.status_code == 401
        assert r.json()["detail"]["error"] == "invalid_api_key"

    def test_empty_usage_returns_zeros(self, db):
        plan = make_plan(db)
        tenant, key = make_tenant(db, plan.id)

        r = get_usage(key)
        assert r.status_code == 200
        data = r.json()

        assert data["plan"] == "free"
        assert data["subscription_status"] == "active"
        assert data["api_calls"]["used"] == 0
        assert data["api_calls"]["limit"] == 1_000
        assert data["ai_tokens"]["used"] == 0
        assert data["ai_tokens"]["limit"] == 100_000
        assert data["cost"]["api_calls_micro_usd"] == 0
        assert data["cost"]["tokens_micro_usd"] == 0
        assert data["cost"]["total_micro_usd"] == 0
        assert data["cost"]["total_usd_display"] == "$0.000000"

    def test_usage_aggregates_api_calls_correctly(self, db):
        """After 3 /generate calls, usage.api_calls.used == 3."""
        plan = make_plan(db)
        tenant, key = make_tenant(db, plan.id)

        period = get_period_start()
        import uuid as _uuid
        # Insert 3 api_call events with P_API_CALL cost each
        call_cost = cost_for_api_call()
        for i in range(3):
            db.add(UsageEvent(
                id=_uuid.uuid4(),
                tenant_id=tenant.id,
                usage_type="api_call",
                quantity=1,
                cost_micro_usd=call_cost,
                idempotency_key=f"usage-test-{i}",
                period_start=period,
            ))
        db.commit()

        r = get_usage(key)
        assert r.status_code == 200
        data = r.json()
        assert data["api_calls"]["used"] == 3
        assert data["cost"]["api_calls_micro_usd"] == 3 * call_cost

    def test_usage_aggregates_ai_tokens_correctly(self, db):
        """After recording tokens, used and cost are summed correctly."""
        plan = make_plan(db)
        tenant, key = make_tenant(db, plan.id)

        period = get_period_start()
        import uuid as _uuid

        token_cost = cost_for_tokens(1000, 2000, 500, 300)  # 2360
        db.add(UsageEvent(
            id=_uuid.uuid4(),
            tenant_id=tenant.id,
            usage_type="ai_tokens",
            quantity=3800,  # 1000+2000+500+300
            input_tokens=1000,
            cached_input_tokens=2000,
            output_tokens=500,
            reasoning_tokens=300,
            cost_micro_usd=token_cost,
            idempotency_key="usage-token-test-1",
            period_start=period,
        ))
        db.commit()

        r = get_usage(key)
        assert r.status_code == 200
        data = r.json()
        assert data["ai_tokens"]["used"] == 3800
        assert data["cost"]["tokens_micro_usd"] == 2360

    def test_usage_cost_total_is_sum_of_api_plus_tokens(self, db):
        """total_micro_usd == api_calls_micro_usd + tokens_micro_usd."""
        plan = make_plan(db)
        tenant, key = make_tenant(db, plan.id)

        period = get_period_start()
        import uuid as _uuid

        call_cost = cost_for_api_call()   # 1000
        token_cost = cost_for_tokens(1000, 2000, 500, 300)  # 2360

        db.add(UsageEvent(
            id=_uuid.uuid4(), tenant_id=tenant.id, usage_type="api_call",
            quantity=1, cost_micro_usd=call_cost,
            idempotency_key="cost-test-api", period_start=period,
        ))
        db.add(UsageEvent(
            id=_uuid.uuid4(), tenant_id=tenant.id, usage_type="ai_tokens",
            quantity=3800, cost_micro_usd=token_cost,
            idempotency_key="cost-test-tok", period_start=period,
        ))
        db.commit()

        r = get_usage(key)
        assert r.status_code == 200
        data = r.json()
        cost = data["cost"]
        assert cost["api_calls_micro_usd"] == call_cost
        assert cost["tokens_micro_usd"] == token_cost
        assert cost["total_micro_usd"] == call_cost + token_cost
        # Display: 3360 / 1_000_000 = $0.003360
        assert cost["total_usd_display"] == f"${(call_cost + token_cost) / 1_000_000:.6f}"

    def test_usage_shows_pro_plan_limits(self, db):
        """Pro tenants see pro-tier limits in the response."""
        plan = make_plan(db, name="pro", api_calls_limit=50_000, ai_tokens_limit=5_000_000)
        tenant, key = make_tenant(db, plan.id)

        r = get_usage(key)
        assert r.status_code == 200
        data = r.json()
        assert data["plan"] == "pro"
        assert data["api_calls"]["limit"] == 50_000
        assert data["ai_tokens"]["limit"] == 5_000_000

    def test_usage_shows_subscription_status(self, db):
        """Subscription status is reflected accurately."""
        plan = make_plan(db)
        tenant, key = make_tenant(db, plan.id, subscription_status="past_due")

        r = get_usage(key)
        assert r.status_code == 200
        assert r.json()["subscription_status"] == "past_due"

    def test_usage_period_format_is_yyyy_mm(self, db):
        """Period field uses YYYY-MM format."""
        plan = make_plan(db)
        tenant, key = make_tenant(db, plan.id)

        r = get_usage(key)
        assert r.status_code == 200
        period = r.json()["period"]
        # Must match YYYY-MM pattern
        assert len(period) == 7
        assert period[4] == "-"
        assert period[:4].isdigit()
        assert period[5:].isdigit()

    def test_usage_isolates_tenants(self, db):
        """Tenant B's usage never appears in Tenant A's /usage response."""
        plan = make_plan(db)
        tenant_a, key_a = make_tenant(db, plan.id, name="A")
        tenant_b, key_b = make_tenant(db, plan.id, name="B")

        period = get_period_start()
        import uuid as _uuid
        # Insert 5 api_call events for tenant_b
        for i in range(5):
            db.add(UsageEvent(
                id=_uuid.uuid4(), tenant_id=tenant_b.id, usage_type="api_call",
                quantity=1, cost_micro_usd=1000,
                idempotency_key=f"isolation-b-{i}", period_start=period,
            ))
        db.commit()

        r = get_usage(key_a)
        assert r.status_code == 200
        data = r.json()
        assert data["api_calls"]["used"] == 0, "Tenant A must not see Tenant B's events"

    def test_me_endpoint(self, db):
        plan = make_plan(db, name="free")
        tenant, key = make_tenant(db, plan.id, name="Tenant Me Test")

        r = client.get("/me", headers={"X-API-Key": key})
        assert r.status_code == 200
        data = r.json()
        assert data["name"] == "Tenant Me Test"
        assert data["plan"] == "free"
        assert data["subscription_status"] == "active"
        assert data["id"] == str(tenant.id)

    def test_me_unauthenticated(self):
        r = client.get("/me")
        assert r.status_code in (401, 422)

    def test_usage_events_endpoint(self, db):
        import uuid as _uuid
        plan = make_plan(db)
        tenant_a, key_a = make_tenant(db, plan.id, name="A")
        tenant_b, key_b = make_tenant(db, plan.id, name="B")

        period = get_period_start()
        # Add 2 events for A
        db.add(UsageEvent(
            id=_uuid.uuid4(), tenant_id=tenant_a.id, usage_type="api_call",
            quantity=1, cost_micro_usd=1000,
            idempotency_key="ev-a-1", period_start=period,
        ))
        db.add(UsageEvent(
            id=_uuid.uuid4(), tenant_id=tenant_a.id, usage_type="ai_tokens",
            quantity=500, input_tokens=300, cached_input_tokens=50, output_tokens=100, reasoning_tokens=50,
            cost_micro_usd=2500, idempotency_key="ev-a-2", period_start=period,
        ))
        # Add 1 event for B
        db.add(UsageEvent(
            id=_uuid.uuid4(), tenant_id=tenant_b.id, usage_type="api_call",
            quantity=1, cost_micro_usd=1000,
            idempotency_key="ev-b-1", period_start=period,
        ))
        db.commit()

        # Check tenant_a gets only its 2 events
        r = client.get("/usage/events?limit=20", headers={"X-API-Key": key_a})
        assert r.status_code == 200
        events = r.json()
        assert len(events) == 2
        types = [e["usage_type"] for e in events]
        assert "api_call" in types
        assert "ai_tokens" in types
        for ev in events:
            assert "token_breakdown" in ev
            assert "cost_usd_display" in ev
            assert "created_at" in ev
            assert ev["idempotency_key"].startswith("ev-a-")

        # Check tenant_b gets only its 1 event
        r_b = client.get("/usage/events", headers={"X-API-Key": key_b})
        assert r_b.status_code == 200
        events_b = r_b.json()
        assert len(events_b) == 1
        assert events_b[0]["idempotency_key"] == "ev-b-1"

    def test_cors_preflight(self):
        headers = {
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "X-API-Key, Idempotency-Key, Content-Type",
        }
        r = client.options("/generate", headers=headers)
        assert r.status_code == 200
        assert r.headers.get("access-control-allow-origin") == "http://localhost:3000"
        allow_headers = r.headers.get("access-control-allow-headers", "").lower()
        assert "x-api-key" in allow_headers
        assert "idempotency-key" in allow_headers
        assert "content-type" in allow_headers
