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
- **OTP brute-force protection** — password reset OTPs are frozen after 5 wrong
  guesses (`locked = true`) and a 60-second resend cooldown prevents email spam;
  all state tracked in Postgres with zero additional infrastructure.

---

## ASCII Architecture Diagram

```
Client
  │
  │ X-API-Key  / Idempotency-Key / Bearer JWT
  ▼
FastAPI (app/main.py)
  ├── POST /generate           ──► metering.py ──► quota.py (FOR UPDATE)
  │                                           └──► pricing.py (integer μ$)
  ├── GET  /usage              ──► aggregate usage_events
  ├── GET  /usage/events       ──► tenant-isolated latest event records
  ├── GET  /me                 ──► tenant plan & profile info
  ├── POST /checkout           ──► Polar SDK → checkout URL (sandbox/prod)
  ├── POST /webhooks/polar     ──► HMAC verify → billing_sync.py → tenant/subscription
  ├── GET  /api/cron/reconcile ──► Polar SDK → reconcile & alerts (sync/async)
  ├── POST /api/auth/*         ──► signup, login, OTP reset, Google OAuth
  └── GET  /health             ──► DB ping

PostgreSQL on Neon (QueuePool / PgBouncer tuned)
  ├── plans
  ├── tenants
  ├── subscriptions
  ├── usage_events    (UNIQUE tenant+ikey+type; index tenant+period+type)
  ├── idempotency_keys
  ├── webhook_events
  ├── users
  ├── refresh_tokens
  └── password_reset_tokens   (attempt_count + locked for OTP freeze)
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

## Background Job (Subscription Reconciliation)

The engine features a dedicated background job (`app/jobs/reconcile.py`) designed to move slow external reconciliation work completely off the request path.

### Key Capabilities
- **Bounded Retry Policy**: Retries transient network failures, connection timeouts, HTTP 429 rate limits, and 5xx server errors with exponential backoff and randomized jitter.
- **Header-Aware Backoff**: Strictly honors Polar's `Retry-After` header when rate limited.
- **Fail-Fast for Permanent Errors**: 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, and invalid configuration are never retried.
- **Structured Failure Alerting (`app/jobs/alerts.py`)**: Emits observable, structured alerts (`FAILURE_ALERT`) on exhausted retries, unhandled crashes, or client initialization failures. Supports alert deduplication within a configurable TTL window to prevent alert spam, and provides an optional webhook dispatch point (`ALERT_WEBHOOK_URL`).
- **Failure Isolation**: An error or retry failure on one subscription never impedes or halts reconciliation of unrelated subscriptions.
- **Concurrency Safety**: Thread-safe execution lock guards against overlapping runs in the same environment.

### Configuration (`.env`)
```bash
RECONCILE_MAX_RETRIES=3          # Maximum number of retry attempts for transient errors
RECONCILE_BACKOFF_BASE=0.5       # Exponential backoff base in seconds
RECONCILE_BACKOFF_MAX=5.0        # Maximum backoff sleep in seconds
RECONCILE_REQUEST_TIMEOUT=5.0    # Per-request timeout for payment provider calls
ALERT_WEBHOOK_URL=               # (Optional) Webhook URL for external alert routing (Slack/PagerDuty)
```

### Execution Modes

1. **Independent CLI Runner (Off the Request Path)**:
```bash
python -m app.jobs.reconcile
```

2. **Asynchronous Background HTTP Dispatch (Off the Request Path)**:
```bash
curl -s -X GET "http://localhost:8000/api/cron/reconcile?sync=false" \
  -H "Authorization: Bearer <CRON_SECRET>"
# Returns immediately with HTTP 202 Accepted and executes in background
```

3. **Synchronous Cron Collector**:
```bash
curl -s -X GET "http://localhost:8000/api/cron/reconcile" \
  -H "Authorization: Bearer <CRON_SECRET>"
# {"status":"ok","run_id":"a8b1c2d3","checked":2,"mismatched":0,"errored":0,"aborted":false}
```

On Vercel, the cron schedule in `vercel.json` triggers this at midnight UTC daily.

### Alert Observability & Troubleshooting
Failure alerts are formatted as structured JSON logs:
```json
{
  "job_name": "reconciliation",
  "run_id": "a8b1c2d3",
  "failure_category": "RETRIES_EXHAUSTED",
  "severity": "ERROR",
  "message": "Failed to fetch live status from provider after 4 attempts: PolarServerError",
  "attempt_count": 4,
  "tenant_identifier": "7f8b9a1c",
  "subscription_identifier": "sub_12345",
  "timestamp": "2026-10-24T02:00:00Z"
}
```
If an `ALERT_WEBHOOK_URL` is configured, alerts are dispatched via HTTP POST with a bounded timeout and non-blocking failure recovery. Safe identifiers are logged (first 8 characters of UUIDs); secrets and auth tokens are never logged.

---

## Production & Security Hardening

HisaabLedger implements defence-in-depth across the API, database, and client layers:
- **Strict Cron Isolation:** POST /api/cron/reconcile strictly requires constant-time HMAC Authorization: Bearer <CRON_SECRET> validation to prevent unauthorized job triggers.
- **Secret Scanning Ready:** All generated tenant API keys follow standard secret scanning formats (k_live_<hash>) for TruffleHog and GitHub Secret Scanning detection.
- **OTP Brute-Force & Flood Protection:** 6-digit verification codes freeze automatically after 5 incorrect attempts (locked = true) and enforce a 60-second re-request cooldown (HTTP 429).
- **Cryptographic OAuth Validation:** Google sign-in verifies Google ID tokens server-side via Google's tokeninfo API (ud, signature, verified email).
- **HTTP Security Headers & CSP:** Next.js serves strict CSP, HSTS (max-age=63072000; preload), X-Frame-Options: DENY, X-Content-Type-Options: nosniff, and Referrer-Policy.
- **Edge Route Protection:** Next.js middleware guards application routes (/dashboard, /playground, /events, /connect) against unauthenticated access.

## Limitations

- No invoicing, proration, or overage billing.
- Polar sandbox only — production Polar would require changing `POLAR_SERVER=production`.
- AI generation is simulated; no real LLM is called.

---

## Web UI (Reviewer Demo)

A dedicated, lightweight demonstration UI is available in `web/` built with **Next.js (App Router)**, **TypeScript**, and **Tailwind CSS**. It is designed specifically for evaluators to visually inspect metering, idempotency replay, quota gating, and live Polar upgrades.

### Features
1. **Connect Screen (`/connect`):** Connect any tenant via `X-API-Key` (stored only in `sessionStorage`) or 1-click fill via the public demo key.
2. **Dashboard (`/dashboard`):** Real-time plan badge, subscription status, dual progress bars for API calls and AI tokens (changing colors at 80% warning and 100% hard ceiling), micro-USD cost breakdown, and "Upgrade to Pro" checkout button with auto-polling.
3. **Playground (`/playground`):** Live simulator for `POST /generate` with configurable token tiers (fresh input, cached, output, reasoning), an auto-generated `Idempotency-Key`, a "Reuse same key" toggle, and a "Send Twice" button to observe immediate replay caching and quota locks.
4. **Events Ledger (`/events`):** Tenant-isolated audit table displaying the latest 20 usage events with token breakdowns and micro-USD calculations.

### Running the Web UI locally
```bash
# Navigate to web directory
cd web

# Install dependencies
npm install

# Configure environment variables
# Copy .env.local.example to .env.local if needed
# NEXT_PUBLIC_API_URL=http://localhost:8000
# NEXT_PUBLIC_DEMO_API_KEY=<demo_tenant_key>

# Run development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the UI.

### Vercel Deployment (Second Project)
Deploy `web/` as an independent Vercel project connected to the same repository:
- **Root Directory:** `web`
- **Framework Preset:** Next.js
- **Environment Variables:**
  - `NEXT_PUBLIC_API_URL`: URL of the deployed FastAPI backend (e.g. `https://your-api.vercel.app`)
  - `NEXT_PUBLIC_DEMO_API_KEY`: Evaluation tenant API key for the "Use demo key" button.

### UI Previews & Screenshots

```
┌────────────────────────────────────────────────────────────────────────┐
│  FlyRank  [Dashboard] [Playground] [Events]             Tenant A (free)│
├────────────────────────────────────────────────────────────────────────┤
│  Usage Dashboard  [FREE] [ACTIVE]                                      │
│                                                                        │
│  API Calls Quota                     AI Tokens Quota                   │
│  [████████████░░░░░░░░░░░░] 52%      [████████████████████] 100%       │
│  Used: 520 / 1,000                   Used: 100,000 / 100,000 (RED)     │
│                                                                        │
│  Period Cost Breakdown                                                 │
│  API Calls: $0.520000    Tokens: $0.236000    Total: $0.756000         │
│                                                                        │
│  [ Upgrade to Pro ] ──► Redirects to Polar Sandbox Checkout            │
└────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────┐
│  Playground Live Demo                                                  │
│  [Prompt: Summarize Q3 report...]  [Tokens: In: 300 Cached: 50 Out: 150]│
│  Idempotency-Key: [ 9b1deb4d-... ] [x] Reuse Key                       │
│  [ Send POST /generate ]  [ Send Twice (Verify Idempotency) ]          │
│                                                                        │
│  Response Logs:                                                        │
│  ▶ [200 OK] [Idempotent-Replayed: true]                                │
│    {"simulated_usage": {"total_tokens": 575}, "cost_micro_usd": 1420}  │
│  ▶ [402 Quota Exceeded]                                                │
│    {"detail": {"error": "quota_exceeded", "metric": "ai_tokens"}}      │
└────────────────────────────────────────────────────────────────────────┘
```

## Future Ideas

- Webhook retry / dead-letter queue for failed event processing.
- Overage billing: charge per token beyond the quota (instead of hard blocking).
- Usage export endpoint (`GET /usage/export?format=csv`).
- Slack/email alert when reconciliation detects a mismatch.
- Multi-currency support (convert micro-USD to tenant's local currency at display time).
