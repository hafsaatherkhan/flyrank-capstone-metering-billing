"""
Phase 2 test suite — covers all requirements from ANTIGRAVITY_BUILD_PLAN.md:

  ✓ Same request twice → exactly 1 api_call + 1 ai_tokens event; replay identical
  ✓ Same key + different payload → 409
  ✓ Boundary: 999/1000 allowed, 1001/1000 rejected (402 free / 429 pro)
  ✓ All-or-nothing: tokens over limit while calls under → nothing recorded
  ✓ Tenant isolation: A's key can never affect B's usage
  ✓ Concurrency: 20 parallel requests near boundary never exceed limit
  ✓ Invalid payload / missing key → clean 4xx
"""
import concurrent.futures

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models import UsageEvent
from app.services.metering import get_period_start
from tests.conftest import (
    TestingSessionLocal,
    make_plan,
    make_tenant,
)

client = TestClient(app)

# ── Default simulated usage ───────────────────────────────────────────────────
DEFAULT_USAGE = {
    "input_tokens": 100,
    "cached_input_tokens": 50,
    "output_tokens": 80,
    "reasoning_tokens": 20,
}
SMALL_USAGE = {
    "input_tokens": 1,
    "cached_input_tokens": 0,
    "output_tokens": 1,
    "reasoning_tokens": 0,
}


def gen(api_key: str, ikey: str, prompt: str = "Hello", usage: dict | None = None):
    """POST /generate helper."""
    return client.post(
        "/generate",
        json={"prompt": prompt, "simulated_usage": usage or DEFAULT_USAGE},
        headers={"X-API-Key": api_key, "Idempotency-Key": ikey},
    )


def seed_api_call_events(db, tenant_id, count: int):
    """Bulk-insert `count` api_call UsageEvents in one round-trip."""
    import uuid as _uuid
    period = get_period_start()
    db.bulk_insert_mappings(UsageEvent, [
        {
            "id": _uuid.uuid4(),
            "tenant_id": tenant_id,
            "usage_type": "api_call",
            "quantity": 1,
            "input_tokens": 0,
            "cached_input_tokens": 0,
            "output_tokens": 0,
            "reasoning_tokens": 0,
            "cost_micro_usd": 1_000,
            "idempotency_key": f"seed-call-{i}",
            "period_start": period,
            "created_at": period,
        }
        for i in range(count)
    ])
    db.commit()


def seed_token_events(db, tenant_id, total_tokens: int):
    """Directly insert ai_tokens UsageEvent to simulate prior token usage."""
    period = get_period_start()
    db.add(UsageEvent(
        tenant_id=tenant_id,
        usage_type="ai_tokens",
        quantity=total_tokens,
        cost_micro_usd=1,
        idempotency_key="seed-tokens-0",
        period_start=period,
    ))
    db.commit()


# ═════════════════════════════════════════════════════════════════════════════
# Idempotency
# ═════════════════════════════════════════════════════════════════════════════
class TestIdempotency:
    def test_same_key_same_payload_replays(self, db, free_tenant):
        """Two identical requests → 1 event pair, second has Idempotent-Replayed: true."""
        tenant, key, _ = free_tenant

        r1 = gen(key, "ikey-001")
        r2 = gen(key, "ikey-001")

        assert r1.status_code == 200
        assert r2.status_code == 200
        assert r2.headers.get("Idempotent-Replayed") == "true"
        assert r1.json() == r2.json()

        events = db.query(UsageEvent).filter_by(tenant_id=tenant.id).all()
        assert len(events) == 2, "Must record exactly 1 api_call + 1 ai_tokens event"
        types = {e.usage_type for e in events}
        assert types == {"api_call", "ai_tokens"}

    def test_same_key_different_payload_returns_409(self, db, free_tenant):
        """Same key, different prompt → 409 idempotency_key_reused."""
        _, key, _ = free_tenant

        r1 = gen(key, "ikey-002")
        assert r1.status_code == 200

        r2 = gen(key, "ikey-002", prompt="A completely different prompt")
        assert r2.status_code == 409
        assert r2.json()["detail"]["error"] == "idempotency_key_reused"

    def test_replay_does_not_create_extra_events(self, db, free_tenant):
        """Five identical replays → still only 2 events in the DB."""
        tenant, key, _ = free_tenant
        for _ in range(5):
            gen(key, "ikey-003")
        events = db.query(UsageEvent).filter_by(tenant_id=tenant.id).all()
        assert len(events) == 2


# ═════════════════════════════════════════════════════════════════════════════
# Quota boundary (free plan, limit = 1 000)
# ═════════════════════════════════════════════════════════════════════════════
class TestQuotaBoundaryFree:
    def test_at_999_used_request_is_allowed(self, db):
        """999 + 1 = 1000 ≤ 1000 → allowed."""
        plan = make_plan(db, api_calls_limit=1_000, ai_tokens_limit=100_000)
        tenant, key = make_tenant(db, plan.id)
        seed_api_call_events(db, tenant.id, 999)

        r = gen(key, "boundary-999", usage=SMALL_USAGE)
        assert r.status_code == 200

    def test_at_1000_used_next_request_rejected_402(self, db):
        """1000 used + 1 requested > 1000 → 402 quota_exceeded."""
        plan = make_plan(db, api_calls_limit=1_000, ai_tokens_limit=100_000)
        tenant, key = make_tenant(db, plan.id)
        seed_api_call_events(db, tenant.id, 1_000)

        r = gen(key, "over-limit", usage=SMALL_USAGE)
        assert r.status_code == 402
        body = r.json()["detail"]
        assert body["error"] == "quota_exceeded"
        assert body["used"] == 1_000
        assert body["limit"] == 1_000
        assert body["requested"] == 1
        assert "upgrade" in body

    def test_at_limit_used_correct_fields_present(self, db):
        """Response body must include used, limit, requested, upgrade."""
        plan = make_plan(db, api_calls_limit=5, ai_tokens_limit=100_000)
        tenant, key = make_tenant(db, plan.id)
        seed_api_call_events(db, tenant.id, 5)

        r = gen(key, "fields-check", usage=SMALL_USAGE)
        assert r.status_code == 402
        body = r.json()["detail"]
        for field in ("error", "used", "limit", "requested", "upgrade"):
            assert field in body, f"Missing field: {field}"


# ═════════════════════════════════════════════════════════════════════════════
# Quota boundary (pro plan)
# ═════════════════════════════════════════════════════════════════════════════
class TestQuotaBoundaryPro:
    def test_pro_over_quota_returns_429_with_retry_after(self, db):
        """Pro plan over quota → 429 + Retry-After header."""
        plan = make_plan(db, name="pro", api_calls_limit=10, ai_tokens_limit=5_000_000)
        tenant, key = make_tenant(db, plan.id)
        seed_api_call_events(db, tenant.id, 10)

        r = gen(key, "pro-overlimit", usage=SMALL_USAGE)
        assert r.status_code == 429
        assert "Retry-After" in r.headers
        assert int(r.headers["Retry-After"]) > 0
        assert r.json()["detail"]["error"] == "quota_exceeded"


# ═════════════════════════════════════════════════════════════════════════════
# All-or-nothing
# ═════════════════════════════════════════════════════════════════════════════
class TestAllOrNothing:
    def test_tokens_over_limit_calls_under_nothing_recorded(self, db):
        """Token limit exceeded → zero events written, even though calls are under."""
        plan = make_plan(db, api_calls_limit=1_000, ai_tokens_limit=100)
        tenant, key = make_tenant(db, plan.id)

        # Request 200 tokens against a 100-token limit
        r = gen(key, "all-or-nothing", usage={
            "input_tokens": 200, "cached_input_tokens": 0,
            "output_tokens": 0, "reasoning_tokens": 0,
        })
        assert r.status_code == 402
        events = db.query(UsageEvent).filter_by(tenant_id=tenant.id).all()
        assert len(events) == 0, "Nothing must be written when any dimension exceeds limit"

    def test_calls_over_limit_tokens_under_nothing_recorded(self, db):
        """Call limit exceeded → zero events written, even though tokens are under."""
        plan = make_plan(db, api_calls_limit=0, ai_tokens_limit=100_000)
        tenant, key = make_tenant(db, plan.id)

        r = gen(key, "aon-calls", usage=SMALL_USAGE)
        assert r.status_code == 402
        events = db.query(UsageEvent).filter_by(tenant_id=tenant.id).all()
        assert len(events) == 0


# ═════════════════════════════════════════════════════════════════════════════
# Tenant isolation
# ═════════════════════════════════════════════════════════════════════════════
class TestTenantIsolation:
    def test_tenant_a_events_invisible_to_tenant_b(self, db):
        """Tenant A's usage events are never visible to B."""
        plan = make_plan(db, api_calls_limit=1_000, ai_tokens_limit=100_000)
        tenant_a, key_a = make_tenant(db, plan.id, name="A")
        tenant_b, key_b = make_tenant(db, plan.id, name="B")

        gen(key_a, "a-001")
        gen(key_a, "a-002")

        events_b = db.query(UsageEvent).filter_by(tenant_id=tenant_b.id).all()
        assert len(events_b) == 0

        events_a = db.query(UsageEvent).filter_by(tenant_id=tenant_a.id).all()
        assert len(events_a) == 4  # 2 × (api_call + ai_tokens)

    def test_tenant_b_key_cannot_exhaust_tenant_a_quota(self, db):
        """Using B's key never touches A's counters."""
        plan = make_plan(db, api_calls_limit=1_000, ai_tokens_limit=100_000)
        tenant_a, key_a = make_tenant(db, plan.id, name="A")
        tenant_b, key_b = make_tenant(db, plan.id, name="B")

        # Exhaust B
        seed_api_call_events(db, tenant_b.id, 1_000)
        r_b = gen(key_b, "b-over")
        assert r_b.status_code == 402

        # A is unaffected
        r_a = gen(key_a, "a-unaffected")
        assert r_a.status_code == 200

    def test_invalid_key_returns_401(self, client):
        """A key that belongs to no tenant → 401."""
        r = client.post(
            "/generate",
            json={"prompt": "hi", "simulated_usage": SMALL_USAGE},
            headers={"X-API-Key": "totally-fake-key", "Idempotency-Key": "k1"},
        )
        assert r.status_code == 401
        assert r.json()["detail"]["error"] == "invalid_api_key"


# ═════════════════════════════════════════════════════════════════════════════
# Concurrency — 20 parallel requests near the boundary must never exceed limit
# ═════════════════════════════════════════════════════════════════════════════
class TestConcurrency:
    def test_20_parallel_requests_never_exceed_limit_of_15(self, db):
        """
        With a call limit of 15, 20 concurrent threads must result in
        at most 15 recorded api_call events.
        """
        plan = make_plan(db, api_calls_limit=15, ai_tokens_limit=1_000_000)
        tenant, key = make_tenant(db, plan.id)

        def fire(i: int):
            return gen(key, f"concurrent-{i}", usage=SMALL_USAGE).status_code

        with concurrent.futures.ThreadPoolExecutor(max_workers=20) as pool:
            statuses = list(pool.map(fire, range(20)))

        # Count recorded api_call events
        recorded = (
            db.query(UsageEvent)
            .filter_by(tenant_id=tenant.id, usage_type="api_call")
            .count()
        )
        assert recorded <= 15, f"Recorded {recorded} events; limit is 15"
        assert statuses.count(200) == recorded
        assert statuses.count(200) + statuses.count(402) == 20


# ═════════════════════════════════════════════════════════════════════════════
# Invalid input / missing headers → clean 4xx
# ═════════════════════════════════════════════════════════════════════════════
class TestInvalidInput:
    def test_missing_api_key_header_returns_422(self, client):
        r = client.post(
            "/generate",
            json={"prompt": "hi", "simulated_usage": SMALL_USAGE},
            headers={"Idempotency-Key": "k1"},
        )
        # FastAPI 422 when required Header is absent
        assert r.status_code == 422

    def test_missing_idempotency_key_header_returns_422(self, db, free_tenant):
        _, key, _ = free_tenant
        r = client.post(
            "/generate",
            json={"prompt": "hi", "simulated_usage": SMALL_USAGE},
            headers={"X-API-Key": key},
        )
        assert r.status_code == 422

    def test_negative_tokens_returns_422(self, db, free_tenant):
        _, key, _ = free_tenant
        r = client.post(
            "/generate",
            json={
                "prompt": "hi",
                "simulated_usage": {
                    "input_tokens": -1, "cached_input_tokens": 0,
                    "output_tokens": 0, "reasoning_tokens": 0,
                },
            },
            headers={"X-API-Key": key, "Idempotency-Key": "neg-001"},
        )
        assert r.status_code == 422

    def test_missing_prompt_returns_422(self, db, free_tenant):
        _, key, _ = free_tenant
        r = client.post(
            "/generate",
            json={"simulated_usage": SMALL_USAGE},
            headers={"X-API-Key": key, "Idempotency-Key": "no-prompt"},
        )
        assert r.status_code == 422

    def test_empty_prompt_returns_422(self, db, free_tenant):
        _, key, _ = free_tenant
        r = client.post(
            "/generate",
            json={"prompt": "", "simulated_usage": SMALL_USAGE},
            headers={"X-API-Key": key, "Idempotency-Key": "empty-prompt"},
        )
        assert r.status_code == 422

    def test_past_due_subscription_returns_402(self, db):
        """Tenant with past_due subscription → 402 payment_required."""
        plan = make_plan(db)
        tenant, key = make_tenant(db, plan.id, subscription_status="past_due")
        r = gen(key, "past-due-001")
        assert r.status_code == 402
        assert r.json()["detail"]["error"] == "payment_required"
