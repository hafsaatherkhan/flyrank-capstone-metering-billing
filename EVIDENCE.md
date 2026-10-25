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

## 8. Background Reconciliation, Retries & Failure Alerting Proofs

### 12 Automated Verification Tests Passing
```
$ pytest tests/test_reconcile.py -v
tests/test_reconcile.py::test_is_transient_error_classification PASSED   [  8%]
tests/test_reconcile.py::test_compute_backoff PASSED                     [ 16%]
tests/test_reconcile.py::test_reconciliation_success_no_retries PASSED   [ 25%]
tests/test_reconcile.py::test_transient_failure_succeeds_on_retry PASSED [ 33%]
tests/test_reconcile.py::test_repeated_transient_failures_stop_after_max PASSED [ 41%]
tests/test_reconcile.py::test_permanent_failures_not_retried PASSED      [ 50%]
tests/test_reconcile.py::test_exhausted_retries_produces_failure_alert PASSED [ 58%]
tests/test_reconcile.py::test_one_failure_does_not_prevent_others PASSED [ 66%]
tests/test_reconcile.py::test_alert_delivery_failure_is_handled_safely PASSED [ 75%]
tests/test_reconcile.py::test_alert_deduplication PASSED                 [ 83%]
tests/test_reconcile.py::test_concurrent_job_execution_safety PASSED     [ 91%]
tests/test_reconcile.py::test_job_runs_independently_via_cli_and_cron_background PASSED [100%]
============================= 12 passed in 48.86s =============================
```

### Proof: Bounded Retry Backoff Logged with Jitter & Attempt Count
```
INFO  app.jobs.reconcile: PROVIDER_FETCH_ATTEMPT job=reconciliation run_id=c148 sub=sub_test tenant=7a18 attempt=1/4
WARNING app.jobs.reconcile: PROVIDER_FETCH_FAILED job=reconciliation run_id=c148 sub=sub_test tenant=7a18 attempt=1/4 category=TRANSIENT_ERROR error=PolarNetworkError
INFO  app.jobs.reconcile: RETRY_BACKOFF job=reconciliation run_id=c148 sub=sub_test sleep_seconds=0.62
INFO  app.jobs.reconcile: PROVIDER_FETCH_ATTEMPT job=reconciliation run_id=c148 sub=sub_test tenant=7a18 attempt=2/4
```

### Proof: Exhausted Retries Emit Verifiable Failure Alert
```
ERROR app.jobs.reconcile: RETRIES_EXHAUSTED job=reconciliation run_id=c148 sub=sub_test tenant=7a18 total_attempts=4
ERROR app.jobs.alerts: FAILURE_ALERT: {"job_name": "reconciliation", "run_id": "c148", "failure_category": "RETRIES_EXHAUSTED", "severity": "ERROR", "message": "Failed to fetch live status from provider after 4 attempts: PolarServerError", "attempt_count": 4, "tenant_identifier": "7a18", "subscription_identifier": "sub_test", "timestamp": "2026-10-24T02:09:40Z", "details": {"error_type": "PolarServerError"}}
```

### Proof: Permanent Errors Fast-Fail Without Redundant Retries
```
INFO  app.jobs.reconcile: PROVIDER_FETCH_ATTEMPT job=reconciliation run_id=e902 sub=sub_invalid tenant=3b21 attempt=1/4
WARNING app.jobs.reconcile: PROVIDER_FETCH_FAILED job=reconciliation run_id=e902 sub=sub_invalid tenant=3b21 attempt=1/4 category=PERMANENT_ERROR error=PolarClientError
ERROR app.jobs.alerts: FAILURE_ALERT: {"job_name": "reconciliation", "run_id": "e902", "failure_category": "PERMANENT_ERROR", "severity": "ERROR", ...}
```

---

## 9. Full Test Suite Summary

```
$ pytest -q
..........................................................                   [100%]
57 passed
```
Total tests: **57 passed, 0 failed, 0 errors** (including new CORS preflight, `GET /me`, and tenant-isolated `GET /usage/events` tests).

---

## 10. OTP Security Hardening — Brute-Force Freeze & Resend Cooldown

### Migration applied cleanly
```
$ alembic upgrade head
INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.runtime.migration] Will assume transactional DDL.
INFO  [alembic.runtime.migration] Running upgrade d0cabecb28e4 -> a1f3e9c2b847, otp_attempt_count_and_locked
```
Two new columns — `attempt_count INTEGER NOT NULL DEFAULT 0` and `locked BOOLEAN NOT NULL DEFAULT false` — added to `password_reset_tokens` with safe server-side defaults (zero downtime on existing rows).

### Resend cooldown — 429 on rapid re-request
**Behaviour:** `POST /forgot-password` called twice within 60 seconds for the same email returns:
```json
// HTTP 429 Too Many Requests
{
  "detail": "Please wait 60 seconds before requesting a new OTP."
}
```
The first request's OTP remains active; no new email is dispatched; no SMTP cost incurred.

### Wrong OTP attempt tracking — countdown in response
**Attempt 1 (wrong OTP):**
```json
// HTTP 400 Bad Request
{
  "detail": "Incorrect OTP. 4 attempts remaining before this OTP is locked."
}
```
**Attempt 4 (wrong OTP):**
```json
// HTTP 400 Bad Request
{
  "detail": "Incorrect OTP. 1 attempt remaining before this OTP is locked."
}
```

### OTP freeze — locked after 5 wrong guesses
**Attempt 5 (wrong OTP):**
```json
// HTTP 429 Too Many Requests
{
  "detail": "Too many incorrect attempts. This OTP has been locked. Please request a new OTP."
}
```
At this point `password_reset_tokens.locked = true` in the DB. Subsequent calls with any OTP value (correct or not) return `400 "Invalid, expired, or already used OTP. Please request a new one."` until a fresh OTP is issued via `POST /forgot-password` (subject to the 60 s cooldown).

### Full suite still green after changes
```
$ pytest tests/ -q --ignore=tests/test_generate.py
...................................................                          [100%]
51 passed in 417.44s (0:06:57)
```
Zero regressions across all 51 non-generate tests.  
*(`test_generate.py` passes in full suite runs; slow live AI calls exceed `--timeout=30` when that flag is used — pre-existing, unrelated to OTP changes.)*

---

## 11. End-to-End Production & Full-Stack Security Verification

### Comprehensive Test Suite Status
All unit, integration, and security tests pass cleanly across the backend:
`
$ pytest -q
......................................................................   [100%]
70 passed in 552.41s
`
**Total tests:** 70 passed, 0 failed, 0 errors.

### Next.js Production Build & Security Header Compilation
`
$ cd web && npm run build
> web@0.1.0 build
> next build

✓ Compiled successfully
✓ Generating static pages (12/12)
✓ Finalizing page optimization

Route (app)                              Size     First Load JS
┌ ○ /                                    5.42 kB        112 kB
├ ○ /about                               2.11 kB        105 kB
├ ○ /connect                             3.84 kB        109 kB
├ ○ /dashboard                           8.19 kB        121 kB
├ ○ /events                              4.56 kB        114 kB
├ ○ /forgot-password                     3.42 kB        108 kB
├ ○ /help/faqs                           2.85 kB        106 kB
├ ○ /help/how-to-use                     3.12 kB        106 kB
├ ○ /help/what-to-expect                 2.78 kB        106 kB
├ ○ /login                               4.15 kB        109 kB
├ ○ /playground                          6.92 kB        117 kB
└ ○ /signup                              4.31 kB        109 kB
`
Next.js edge middleware (web/middleware.ts) and security response headers (HSTS, CSP, X-Frame-Options, X-Content-Type-Options) compile cleanly with zero runtime warnings or errors.

### Security Enforcements Summary
1. **Administrative Cron Protection:** POST /api/cron/reconcile strictly requires constant-time HMAC verified Authorization: Bearer <CRON_SECRET>. Missing or invalid tokens return 403 Forbidden.
2. **Scanner-Friendly API Keys:** Tenant API keys provisioned with k_live_ prefix for automated Git secret leak detection.
3. **Google ID Token Validation:** Validated via Google's OAuth2 tokeninfo service (ud, email_verified, sub).
4. **Edge Route Protection:** Unauthenticated requests to protected paths (/dashboard, /playground, /events, /connect) automatically redirected to /login?from=<target>.
