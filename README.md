# Usage Metering & Billing Engine (FlyRank Capstone)

A production-grade, multi-tenant usage metering and subscription billing engine
built with **FastAPI**, **PostgreSQL on Neon**, and **Polar.sh sandbox**.

---

## What It Does

- **Multi-tenant metering** — every API call and every token (fresh input, cached
  input, output, reasoning) is recorded atomically to an append-only ledger.
- **Idempotent API** — every `POST /generate` requires an `Idempotency-Key` header;
  replays are detected in O(1) and the original response is returned unchanged.
- **Quota enforcement** — per-tenant, per-calendar-month quotas with pessimistic
  row-locking (`SELECT … FOR UPDATE`) guarantee that limits are never exceeded even
  under 20 concurrent threads.
- **All-or-nothing writes** — if either API calls or tokens would exceed the limit,
  zero events are recorded.
- **Integer math only** — all money stored in micro-USD (`int`); one `ROUND_HALF_UP`
  per event, never per category.
- **Subscription billing** — Free → Pro upgrade through Polar sandbox checkout;
  Standard Webhooks HMAC verification; deduplication via `webhook-id`.
- **Reconciliation job** — `GET /api/cron/reconcile` (Vercel Cron) compares local
  subscription state with Polar's live API and logs mismatches.

---

## ASCII Architecture Diagram

```
Client
  │
  │ X-API-Key  / Idempotency-Key
  ▼
FastAPI (app/main.py)
  ├── POST /generate    ──► metering.py ──► quota.py (FOR UPDATE)
  │                                    └──► pricing.py (integer μ$)
  ├── GET  /usage       ──► aggregate usage_events
  ├── POST /checkout    ──► Polar SDK → checkout URL
  ├── POST /webhooks/polar ──► HMAC verify → billing_sync.py → tenant/subscription
  ├── GET  /api/cron/reconcile ──► Polar SDK → log mismatches
  └── GET  /health      ──► DB ping

PostgreSQL on Neon (pooled, NullPool)
  ├── plans
  ├── tenants
  ├── subscriptions
  ├── usage_events    (UNIQUE tenant+ikey+type; index tenant+period+type)
  ├── idempotency_keys
  └── webhook_events
```

---

## Plans & Quotas

| Plan | API calls / month | AI tokens / month |
|------|-------------------|-------------------|
| free | 1,000             | 100,000           |
| pro  | 50,000            | 5,000,000         |

---

## Pricing (integer micro-USD)

| Item                  | Price (per 1M tokens unless stated) |
|-----------------------|-------------------------------------|
| Fresh input tokens    | 300,000 μ$ ($0.30)                  |
| Cached input tokens   | 30,000 μ$ ($0.03)                   |
| Output tokens         | 2,500,000 μ$ ($2.50)                |
| Reasoning tokens      | 2,500,000 μ$ (same as output)       |
| API call (flat)       | 1,000 μ$ per call ($0.001)          |

**Formula (one rounding, at the end):**
```
cost_μ$ = round_half_up(
    (input*300000 + cached*30000 + (output+reasoning)*2500000) / 1_000_000
)
```

Token categories are **disjoint**: `input_tokens` = fresh only; `cached_input_tokens` = cached only. Never double-counted.

---

## Boundary Rule

> A request is **allowed** if `used + requested ≤ limit` for **both** dimensions.
> The request is **all-or-nothing**: if *either* calls or tokens would exceed the
> limit, zero events are written.

At 999/1000 with `requested=1` → allowed (becomes 1000/1000).  
At 1000/1000 with `requested=1` → rejected.

---

## Status Code Contract

| Situation | Status | Error key |
|-----------|--------|-----------|
| Missing / invalid API key | 401 | `invalid_api_key` |
| Invalid payload | 422 | `validation_error` |
| Same key + different payload | 409 | `idempotency_key_reused` |
| Same key + same payload | original status + `Idempotent-Replayed: true` | — |
| **Free** plan over quota | **402** | `quota_exceeded` |
| **Pro** plan over quota | **429** + `Retry-After` | `quota_exceeded` |
| Subscription `past_due`/`canceled` | 402 | `payment_required` |
| Forged webhook signature | 400 | — (no DB change) |
| Duplicate webhook event | 200 | `duplicate_ignored` |

---

## Local Setup (4 steps, no Docker)

```bash
# 1. Create and activate virtualenv
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS / Linux

# 2. Install dependencies
pip install -r requirements.txt

# 3. Copy .env.example → .env and fill in your Neon URLs + Polar credentials
copy .env.example .env

# 4. Apply migrations + seed demo data
alembic upgrade head
python scripts/seed.py          # prints two demo API keys (store them)

# 5. Run the dev server
uvicorn app.main:app --reload   # or: uvicorn app.main:app --port 8000
```

Visit `http://localhost:8000/docs` for interactive Swagger UI.

---

## API Reference (curl examples)

### Health check
```bash
curl http://localhost:8000/health
# {"status":"ok","db":"connected"}
```

### Simulate an AI generation request
```bash
curl -s -X POST http://localhost:8000/generate \
  -H "X-API-Key: <your-api-key>" \
  -H "Idempotency-Key: req-$(date +%s)" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Hello world","simulated_usage":{"input_tokens":100,"cached_input_tokens":50,"output_tokens":80,"reasoning_tokens":20}}'
```

### Get usage for current month
```bash
curl -s http://localhost:8000/usage \
  -H "X-API-Key: <your-api-key>"
# {"period":"2026-10","plan":"free","subscription_status":"active",
#  "api_calls":{"used":1,"limit":1000},
#  "ai_tokens":{"used":250,"limit":100000},
#  "cost":{"api_calls_micro_usd":1000,"tokens_micro_usd":345,
#          "total_micro_usd":1345,"total_usd_display":"$0.001345"}}
```

### Create a Polar checkout (upgrade to Pro)
```bash
curl -s -X POST http://localhost:8000/checkout \
  -H "X-API-Key: <your-api-key>"
# {"checkout_url":"https://sandbox.polar.sh/...","checkout_id":"chk_..."}
```

### Trigger reconciliation manually
```bash
curl -s http://localhost:8000/api/cron/reconcile \
  -H "Authorization: Bearer <CRON_SECRET>"
# {"status":"ok","checked":2,"mismatched":0,"errored":0,"aborted":false}
```

---

## Why Polar and Not Stripe

Stripe is not available in Pakistan. To satisfy the assignment's subscription and
webhook requirements faithfully without regional merchant onboarding barriers,
this engine integrates with **Polar.sh sandbox** (`sandbox.polar.sh`).

Polar is an open-source merchant of record offering:
- Developer-friendly hosted checkouts
- Monthly recurring subscriptions
- **Standard Webhooks** HMAC verification (same spec as Stripe's webhook signing)

Every brief requirement maps 1:1: checkout URL → checkout URL, subscription
events → subscription events, signed webhooks → signed webhooks.

---

## Polar Local Setup

1. **Create account:** Register on [sandbox.polar.sh](https://sandbox.polar.sh).
2. **Create organisation:** Set up a sandbox testing organisation.
3. **Create product:** Under Products, create a recurring monthly product "Pro"
   (e.g. \$20/month). Copy the product ID → `.env` as `POLAR_PRO_PRODUCT_ID`.
4. **Create access token:** Settings → Developers → Personal Access Tokens,
   create a token with sandbox scope → `.env` as `POLAR_ACCESS_TOKEN`.
5. **Register webhook endpoint:** In Polar dashboard, Webhooks section, add
   `http://localhost:8000/webhooks/polar` (for local testing with `polar listen`)
   or your Vercel URL (for production). Copy the signing secret → `.env` as
   `POLAR_WEBHOOK_SECRET`.
6. **Local tunnel (optional):** Use `polar listen --forward http://localhost:8000/webhooks/polar`
   to receive sandbox events locally.
7. **Test card:** Polar sandbox uses `4242 4242 4242 4242` (Visa, any future date, any CVV).

---

## Running Tests

```bash
pytest              # runs all tests (uses DATABASE_URL_TEST)
pytest -v           # verbose
pytest tests/test_pricing.py   # pricing unit tests only (no DB needed)
```

Tests never call Polar's API. Webhook payloads are signed locally with a
test secret using the Standard Webhooks HMAC spec.

---

## Background Job (Reconciliation)

Run manually:
```bash
python -m app.jobs.reconcile
```

Or trigger via HTTP:
```bash
curl -s http://localhost:8000/api/cron/reconcile \
  -H "Authorization: Bearer <CRON_SECRET>"
```

On Vercel, the cron schedule in `vercel.json` triggers this at midnight UTC daily.

---

## Limitations

- No invoicing, proration, or overage billing.
- No frontend UI (Swagger `/docs` is the demo interface).
- Polar sandbox only — production Polar would require changing `POLAR_SERVER=production`.
- AI generation is simulated; no real LLM is called.

## Future Ideas

- Webhook retry / dead-letter queue for failed event processing.
- Overage billing: charge per token beyond the quota (instead of hard blocking).
- Usage export endpoint (`GET /usage/export?format=csv`).
- Slack/email alert when reconciliation detects a mismatch.
- Multi-currency support (convert micro-USD to tenant's local currency at display time).
