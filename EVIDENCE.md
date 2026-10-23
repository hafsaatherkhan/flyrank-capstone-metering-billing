# Evidence & Verification Proofs

This document records verbatim execution outputs and verification proofs for acceptance gates across all build phases.

---

## 1. Concurrency & Idempotency Proofs

### Double-count impossible (same request twice replays identical response)
```
$ pytest tests/test_generate.py -k "test_same_key_same_payload_replays" -v
tests/test_generate.py::TestIdempotency::test_same_key_same_payload_replays PASSED [100%]
====================== 1 passed, 18 deselected in 19.34s ======================
```
Proof: The second invocation returns HTTP 200 with header `Idempotent-Replayed: true` and identical body without creating additional rows in `usage_events`.

### 20-thread concurrency limit compliance
```
$ pytest tests/test_generate.py -k "test_20_parallel_requests_never_exceed_limit_of_15" -v
tests/test_generate.py::TestConcurrency::test_20_parallel_requests_never_exceed_limit_of_15 PASSED [100%]
```
Proof: 20 threads submitting requests near the boundary with limit 15 record at most 15 events due to pessimistic `SELECT ... FOR UPDATE` locking on the tenant row.

---

## 2. Quota Boundary Enforcement Proofs

### Free tier rejection at limit (402 Payment Required)
```
$ pytest tests/test_generate.py -k "test_at_1000_used_next_request_rejected_402" -v
tests/test_generate.py::TestQuotaBoundaryFree::test_at_1000_used_next_request_rejected_402 PASSED [100%]
```
Proof: Request exceeding 1,000 calls returns HTTP 402 with structured body:
```json
{
  "detail": {
    "error": "quota_exceeded",
    "metric": "api_calls",
    "used": 1000,
    "limit": 1000,
    "requested": 1,
    "upgrade": "Upgrade to Pro for higher limits."
  }
}
```

### Pro tier rejection at limit (429 Too Many Requests + Retry-After)
```
$ pytest tests/test_generate.py -k "test_pro_over_quota_returns_429_with_retry_after" -v
tests/test_generate.py::TestQuotaBoundaryPro::test_pro_over_quota_returns_429_with_retry_after PASSED [100%]
```
Proof: Pro tenants over limit receive HTTP 429 along with a `Retry-After` header computing seconds until midnight UTC of the next calendar month.

---

## 3. Tenant Isolation Proofs

### Tenant A usage invisible to Tenant B
```
$ pytest tests/test_generate.py -k "test_tenant_a_events_invisible_to_tenant_b" -v
tests/test_generate.py::TestTenantIsolation::test_tenant_a_events_invisible_to_tenant_b PASSED [100%]
```

### Cross-tenant exhaustion impossibility
```
$ pytest tests/test_generate.py -k "test_tenant_b_key_cannot_exhaust_tenant_a_quota" -v
tests/test_generate.py::TestTenantIsolation::test_tenant_b_key_cannot_exhaust_tenant_a_quota PASSED [100%]
```

### Usage endpoint isolation
```
$ pytest tests/test_usage.py -k "test_usage_isolates_tenants" -v
tests/test_usage.py::TestUsageEndpoint::test_usage_isolates_tenants PASSED [100%]
```

---

## 4. Pricing & Usage Rollup Proofs

### Pure integer math & hand-computed reference pricing
```
$ pytest tests/test_pricing.py -v
tests/test_pricing.py::TestPricingConstants::test_p_in_value PASSED      [  7%]
tests/test_pricing.py::TestPricingConstants::test_p_cached_value PASSED  [ 14%]
tests/test_pricing.py::TestPricingConstants::test_p_out_value PASSED     [ 21%]
tests/test_pricing.py::TestPricingConstants::test_p_api_call_value PASSED [ 28%]
tests/test_pricing.py::TestCostForApiCall::test_returns_flat_1000 PASSED [ 35%]
tests/test_pricing.py::TestCostForApiCall::test_returns_integer PASSED   [ 42%]
tests/test_pricing.py::TestCostForTokens::test_reference_example_from_build_plan PASSED [ 50%]
tests/test_pricing.py::TestCostForTokens::test_cached_cheaper_than_fresh PASSED [ 57%]
tests/test_pricing.py::TestCostForTokens::test_reasoning_billed_at_output_price PASSED [ 64%]
tests/test_pricing.py::TestCostForTokens::test_categories_not_simply_added PASSED [ 71%]
tests/test_pricing.py::TestCostForTokens::test_rounding_once_at_the_end PASSED [ 78%]
tests/test_pricing.py::TestCostForTokens::test_all_zero_tokens_returns_zero PASSED [ 85%]
tests/test_pricing.py::TestCostForTokens::test_returns_integer PASSED    [ 92%]
tests/test_pricing.py::TestCostForTokens::test_large_token_counts PASSED [100%]
============================= 14 passed in 39.15s =============================
```
Hand-computed reference test: `input=1000, cached=2000, output=500, reasoning=300`:
- Formula: `(1000 * 300,000 + 2000 * 30,000 + (500 + 300) * 2,500,000) / 1,000,000 = 2,360 micro-USD`
- Verified: arithmetic matches exactly 2,360.

### Usage rollup matches event totals
```
$ pytest tests/test_usage.py -k "test_usage_cost_total_is_sum_of_api_plus_tokens or test_usage_aggregates_ai_tokens_correctly" -v
tests/test_usage.py::TestUsageEndpoint::test_usage_aggregates_ai_tokens_correctly PASSED [ 50%]
tests/test_usage.py::TestUsageEndpoint::test_usage_cost_total_is_sum_of_api_plus_tokens PASSED [100%]
====================== 2 passed, 8 deselected in 32.38s =======================
```

---

## 5. Polar Sandbox Webhooks & Subscription Transitions

*(Note: Polar.sh sandbox is used in lieu of Stripe test mode due to Pakistan regional unavailability. Every concept maps 1:1.)*

### HMAC Signature Verification & Forged Payload Rejection
```
$ pytest tests/test_billing.py -k "test_forged_or_invalid_signature_returns_400" -v
tests/test_billing.py::TestWebhooksPolar::test_forged_or_invalid_signature_returns_400 PASSED [100%]
```

### Idempotency / Deduplication via `webhook-id`
```
$ pytest tests/test_billing.py -k "test_duplicate_webhook_returns_200_duplicate_ignored" -v
tests/test_billing.py::TestWebhooksPolar::test_duplicate_webhook_returns_200_duplicate_ignored PASSED [100%]
```

### Lifecycle Transition (Free -> Pro via Webhook)
```
$ pytest tests/test_billing.py -k "test_subscription_created_and_active_upgrades_to_pro" -v
tests/test_billing.py::TestWebhooksPolar::test_subscription_created_and_active_upgrades_to_pro PASSED [100%]
```

---

## 6. DB Tables & Schema Inspection

Inspection of tables on Neon PostgreSQL:
```
$ python -c "from app.db import engine; from sqlalchemy import inspect; print(sorted(inspect(engine).get_table_names()))"
['alembic_version', 'idempotency_keys', 'plans', 'subscriptions', 'tenants', 'usage_events', 'webhook_events']
```

---

## 7. Web UI Playground & Quota Verification Note

The Playground interface (`web/app/playground/page.tsx`) provides interactive verification for the core capstone deliverables:

### 1. Replayed Request Proof (Idempotency)
When sending a request with a previously generated `Idempotency-Key` or using the **"Send Twice (Verify Idempotency)"** action:
- **Status:** `200 OK`
- **Response Header:** `Idempotent-Replayed: true`
- **Behavior:** Cached response body returned immediately with zero duplicate rows created in `usage_events`.

### 2. Quota Rejection Proof (402 Payment Required & 429 Rate Limited)
- When a Free tier tenant exceeds 1,000 API calls or 100,000 tokens, the Playground logs:
  ```json
  // HTTP 402 Payment Required
  {
    "detail": {
      "error": "quota_exceeded",
      "metric": "ai_tokens",
      "used": 100000,
      "limit": 100000,
      "requested": 575,
      "upgrade": "Upgrade to Pro for higher limits."
    }
  }
  ```
- When a Pro tier tenant exceeds 50,000 API calls or 5,000,000 tokens, the Playground logs:
  ```json
  // HTTP 429 Too Many Requests
  // Header: Retry-After: <seconds_until_next_month>
  {
    "detail": {
      "error": "quota_exceeded",
      "metric": "api_calls",
      "used": 50000,
      "limit": 50000,
      "requested": 1,
      "retry_after_seconds": 684200
    }
  }
  ```

---

## 8. Full Test Suite Summary

```
$ pytest -q
..........................................................                   [100%]
57 passed
```
Total tests: **57 passed, 0 failed, 0 errors** (including new CORS preflight, `GET /me`, and tenant-isolated `GET /usage/events` tests).
