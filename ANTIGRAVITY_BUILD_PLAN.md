# Build Plan: Usage Metering & Billing Engine (FlyRank Capstone)

You are my pair-programmer. We build this project **one phase at a time**. Read this whole file first, then start with Phase 0 only.

## 0. Working rules (non-negotiable)

1. **Do one phase, then STOP.** After finishing a phase, print the Phase Report (see section 1) and wait for me to reply `go phase N`. Never start the next phase on your own.
2. **Commit locally after each logical step. NEVER run `git push`, never add a remote, never create a GitHub repo.** I will review the full app and push myself at the end.
3. **Small commits.** Each phase should produce 5-10 commits, each one a working step (code + its tests together). Use Conventional Commits: `feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`.
4. **Use real timestamps.** Do not backdate or fake commit dates, do not rewrite history.
5. **Secrets:** `.env` is git-ignored from the very first commit. Only `.env.example` with placeholders is committed. Never log secrets, never print the Stripe key or `whsec_` value.
6. **Money is integers only** (micro-USD). No floats anywhere in money or token math.
7. **Every input is validated at the boundary** (Pydantic). Bad input gives a clean 4xx JSON error, never a 500.
8. **Keep it small.** Do not add features outside this plan (no invoices, proration, overage, UI). If you have a good idea, add it to README under "Future ideas" and move on.
9. **Be honest in `BUILDLOG.md`:** after each phase append an entry: what AI (you) generated, what was wrong or had to be fixed, what I should double-check. Do not write fake "human corrections".
10. **NO DOCKER anywhere.** My computer cannot run Docker. Do not create a Dockerfile or docker-compose. Everything runs with a Python venv + a hosted Neon Postgres database, and deploys to Vercel.
11. **I must be able to explain my own code.** In every Phase Report, include a section "Explain-me": the 3 most important code spots of that phase (file + function + 2 plain-language sentences each).

## 1. Phase Report format (print after every phase)

- Gate result (pass/fail, with the exact command output that proves it)
- List of commits made (`git log --oneline` for this phase)
- Files added/changed
- Explain-me (3 spots)
- Anything I must do manually (e.g. create Stripe test account, run `stripe login`)
- Then the line: `Waiting for: go phase N+1`

## 2. Fixed decisions (do not re-ask)

| Topic | Decision |
|---|---|
| Language/framework | Python 3.12 + FastAPI |
| DB | PostgreSQL on **Neon** (free, hosted). Two databases/branches: `dev` and `test`. Use the **pooled** connection string. SQLite is NOT allowed (we need row locks + JSONB) |
| ORM/migrations | SQLAlchemy 2.x + Alembic (schema only via migrations) |
| Validation | Pydantic v2 |
| Tests | pytest + httpx TestClient, deterministic. Stripe is never called in tests (signed payloads built locally); tests use the Neon `test` DB and clean their tables between tests |
| Payments | Stripe **test mode only**, official `stripe` Python SDK, Stripe CLI for local webhooks |
| Local run | `python -m venv .venv`, `pip install -r requirements.txt`, `alembic upgrade head`, `uvicorn app.main:app --reload` |
| Hosting | **Vercel** (FastAPI as a Vercel Function, zero-config Python runtime) + Neon. Cron via Vercel Cron (a GET route) |
| Auth | Per-tenant API key in header `X-API-Key`, stored as SHA-256 hash, never plaintext |
| Billing period | Calendar month, UTC |
| Repo name (for later) | `flyrank-capstone-metering-billing` |
| License | MIT |

### Plans and quotas (put in config + seed, document in README)

| Plan | API calls / month | AI tokens / month |
|---|---|---|
| free | 1,000 | 100,000 |
| pro | 50,000 | 5,000,000 |

"AI tokens counted against quota" = `input + cached_input + output + reasoning` tokens (all categories).

### Pricing constants (config only, integer micro-USD per 1,000,000 tokens)

| Item | Price |
|---|---|
| API call | 1,000 micro-USD per call ($0.001) |
| Fresh input tokens | 300,000 per 1M ($0.30) |
| Cached input tokens | 30,000 per 1M ($0.03) |
| Output tokens | 2,500,000 per 1M ($2.50) |
| Reasoning tokens | billed at the **output** price |

Token categories are **disjoint**: `input_tokens` means fresh (non-cached) input only; cached input is reported separately and must never be double counted.
Cost formula: `cost_micro_usd = round_half_up((input*P_in + cached*P_cached + (output+reasoning)*P_out) / 1_000_000)`. Round **once per event, at the end**, not per category.

### Status code contract

| Situation | Status | Body |
|---|---|---|
| Missing/invalid API key | 401 | `{"error":"invalid_api_key", "message": ...}` |
| Invalid payload | 422 (or 400) | clean JSON error list |
| Same idempotency key + different payload | 409 | `idempotency_key_reused` |
| Same idempotency key + same payload | original status + original body, header `Idempotent-Replayed: true` | no new event |
| **Free** plan over quota | **402** | `quota_exceeded`, includes `used`, `limit`, `requested`, `upgrade` hint |
| **Pro** plan over quota | **429** | same fields + `Retry-After` header (seconds until next period) |
| Subscription `past_due`/`canceled` (not paying) | 402 | `payment_required` |
| Forged/invalid webhook signature | 400 | nothing changes |
| Duplicate webhook event | 200 | `{"status":"duplicate_ignored"}` |

**Boundary rule (document it exactly in README):** a request is allowed if `used + requested <= limit`. At 999/1000 with requested=1 it is allowed (becomes 1000/1000). The next request (1000 + 1 > 1000) is rejected. A request is all-or-nothing: if either calls or tokens would exceed the limit, nothing is recorded.

## 3. Target project layout

```
app/
  main.py (exposes `app`)  config.py  db.py  models.py  schemas.py  errors.py
  api/        deps.py  generate.py  usage.py  checkout.py  webhooks.py
  services/   metering.py  quota.py  pricing.py  stripe_sync.py
  jobs/       reconcile.py
migrations/   (alembic)
scripts/      seed.py
tests/
docs/         DESIGN.md
requirements.txt  vercel.json  .python-version (3.12)
README.md  EVIDENCE.md  BUILDLOG.md  capstone.yaml  .env.example  .gitignore  LICENSE
```

## 4. Phases

### Phase 0: Repo scaffold (tiny)
- `git init`, branch `main`.
- First commit: `README.md` skeleton, `.gitignore` (must include `.env`, `__pycache__`, `.venv`, `*.db`, `.pytest_cache`), `LICENSE` (MIT), `.env.example`.
- `.env.example` vars: `DATABASE_URL`, `DATABASE_URL_TEST`, `CRON_SECRET`, `STRIPE_SECRET_KEY=sk_test_xxx`, `STRIPE_WEBHOOK_SECRET=whsec_xxx`, `STRIPE_PRO_PRICE_ID=price_xxx`, `APP_BASE_URL`. Note: Neon URLs need `sslmode=require`.
- Empty `EVIDENCE.md` and `BUILDLOG.md` with headings only.
- **Gate:** `git status` clean, `.env` is ignored (`git check-ignore .env` prints it).

### Phase 1: Design (docs only)
Write `docs/DESIGN.md` (one page, max ~120 lines) containing:
1. Problem in 3 sentences.
2. Data model with columns and indexes:
   - `plans(id, name, api_calls_limit, ai_tokens_limit, stripe_price_id)`
   - `tenants(id, name, api_key_hash UNIQUE, plan_id, subscription_status, stripe_customer_id, created_at)`
   - `subscriptions(id, tenant_id, stripe_subscription_id UNIQUE, status, current_period_end)`
   - `idempotency_keys(tenant_id, key, request_hash, response_status, response_body JSONB, created_at, PRIMARY KEY(tenant_id, key))`
   - `usage_events(id, tenant_id, usage_type['api_call'|'ai_tokens'], quantity, input_tokens, cached_input_tokens, output_tokens, reasoning_tokens, cost_micro_usd, idempotency_key, period_start, created_at)` with `UNIQUE(tenant_id, idempotency_key, usage_type)` and index `(tenant_id, period_start, usage_type)`
   - `stripe_events(event_id PRIMARY KEY, type, received_at, processed_at)`
3. API contract: `POST /generate`, `GET /usage`, `POST /checkout`, `POST /webhooks/stripe`, `GET /health`.
4. Idempotency strategy (key lookup first, request hash compare, unique constraint as the final race guard).
5. Concurrency strategy for the quota boundary (`SELECT ... FOR UPDATE` on the tenant row inside the transaction).
6. The boundary rule and status code table from section 2.
7. Layer sketch (HTTP / services / data).
8. **One explicit non-goal:** no invoicing, proration, or overage billing.

- **Gate:** `docs/DESIGN.md` committed. Report it, then STOP.

### Phase 2: Core billing logic
Build in this order, committing after each step:
1. `requirements.txt` (pinned), `.python-version`, `config.py`, `db.py`, `GET /health`. `db.py` must be serverless-friendly: SQLAlchemy engine with `NullPool` (or a very small pool) because Vercel functions are short-lived and Neon's pooler handles pooling. Make sure the FastAPI `app` object is importable from a path Vercel auto-detects (check Vercel's FastAPI docs and adapt, e.g. keep `app/main.py` and add a thin root `main.py`/`index.py` if needed).
2. SQLAlchemy models + first Alembic migration (all tables from DESIGN.md) + `scripts/seed.py` (creates plans free/pro and 2 demo tenants A and B on the free plan; prints their API keys once; idempotent to re-run).
3. Auth dependency (`X-API-Key` -> tenant, constant-time compare on hash).
4. `services/metering.py`: `record(tenant, usage, idempotency_key)` per the strategy in DESIGN.md.
5. `services/quota.py`: current period usage rollup + boundary check.
6. `POST /generate`: body = `{prompt: str, idempotency_key optional via header "Idempotency-Key" (required), simulated_usage: {input_tokens, cached_input_tokens, output_tokens, reasoning_tokens}}`. Tokens are **simulated**, no real AI call. One request records 1 `api_call` event + 1 `ai_tokens` event atomically. Returns a fake generated text plus the recorded usage.
7. Error handlers so nothing leaks as a 500.

Tests required (`tests/`):
- same request twice with same key -> exactly 1 api_call event + 1 ai_tokens event, second response identical, `Idempotent-Replayed: true`
- same key + different payload -> 409
- boundary: 999/1000 allowed, 1000/1000 allowed, next one rejected with correct 402/429 and message
- all-or-nothing: tokens over limit while calls under limit -> nothing recorded
- tenant isolation: tenant A key can never read/affect tenant B usage
- concurrency test: 20 parallel requests near the boundary never exceed the limit
- invalid payload / missing key -> clean 4xx

**Gate:** same request sent twice creates one event; boundary returns 429/402. Show `pytest` output and a curl transcript of the double request.

### Phase 3: Stripe integration (test mode)
1. `POST /checkout`: creates a Stripe Checkout Session (mode=subscription, price from env) for the authenticated tenant; stores `stripe_customer_id` on the tenant; returns the checkout URL. Put `tenant_id` in session `client_reference_id` and metadata.
2. `POST /webhooks/stripe`:
   - read the **raw body**, verify with `stripe.Webhook.construct_event` and `STRIPE_WEBHOOK_SECRET`; invalid -> 400, no DB change
   - insert `event.id` into `stripe_events`; if it already exists -> return 200 `duplicate_ignored`
   - handle `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
   - update tenant plan and `subscription_status` (+ `subscriptions` table); `deleted` returns tenant to free
   - unknown event types: store + 200, do nothing
   - the event-insert and the tenant update happen in one transaction
3. `services/stripe_sync.py` holds the mapping logic so handlers stay thin.
4. README section "Stripe local setup": `stripe login`, `stripe listen --forward-to localhost:8000/webhooks/stripe`, `stripe trigger checkout.session.completed`, test card `4242 4242 4242 4242`.

Tests (no network; build signed payloads locally with the test secret using Stripe's signing scheme):
- forged signature -> 400 and DB unchanged
- same event delivered twice -> processed once
- checkout completed -> tenant free -> pro, `/usage` shows new limits
- subscription deleted -> back to free
- past_due -> 402 `payment_required` on `/generate`

**Gate:** test Checkout (or `stripe trigger`) flips a tenant Free -> Pro via webhook. Tell me exactly which manual steps I must run with my Stripe test account, then STOP.

### Phase 4: Cost, usage endpoint, hardening, docs
1. `services/pricing.py`: pure functions using integer math and config constants only (section 2).
2. `GET /usage` returns `{period, plan, subscription_status, api_calls: {used, limit}, ai_tokens: {used, limit}, cost: {api_calls_micro_usd, tokens_micro_usd, total_micro_usd, total_usd_display}}`.
3. Pricing tests with hand-computed expected totals, including: cached cheaper than fresh, reasoning billed as output, categories not simply added, rounding happens once. Example to include as a test: `input=1000, cached=2000, output=500, reasoning=300` -> `(1000*300000 + 2000*30000 + 800*2500000) / 1e6 = 2360` micro-USD. (Verify this arithmetic in the test, do not trust it blindly.)
4. `jobs/reconcile.py`: a small background job, runnable as `python -m app.jobs.reconcile` AND exposed as `GET /api/cron/reconcile`, protected by `Authorization: Bearer $CRON_SECRET` (Vercel Cron sends it), that compares local subscription status with Stripe's and **logs mismatches loudly** (no auto-fix). Failures must be logged without crashing the loop. This covers the shared "background job" requirement.
5. Logging: structured, never logs secrets or full API keys.
6. `capstone.yaml`: `run:` (`uvicorn app.main:app --port 8000`), `seed:` (`python scripts/seed.py`), `test:` (`pytest`), `base_url:`, endpoints to probe. README documents the 4-step local run from section 2 (no Docker).
7. `README.md` complete: what it does, ASCII architecture diagram, exact run + seed steps (venv, install, migrate, uvicorn, seed), plans table, boundary rule, status code table, pricing rules, Stripe local setup, API docs with curl examples, honest "Limitations", "Future ideas".
8. `EVIDENCE.md`: **one pasted real proof per Section-6 checkbox** (real command output, not invented):
   - double-count impossible (same request twice)
   - quota boundary 429/402 with message
   - tenant isolation
   - pricing totals match `/usage`
   - Stripe checkout -> Pro via webhook
   - forged webhook 400 + duplicate event processed once
   - DB tables present + tenant isolation
   - README/required files present
9. Final self-check: walk the capstone Requirements list and the 5 acceptance probes one by one, run the full test suite and the README run steps from a fresh venv and fresh clone, and report any failing item honestly.

**Gate:** all probes pass locally; `EVIDENCE.md` is filled with real output. Print the final Phase Report plus a "Pre-push checklist":
- [ ] `git log --oneline` shows every phase
- [ ] `git grep -i "sk_test_\|whsec_"` finds only placeholders
- [ ] `.env` was never committed (`git log --all -- .env` is empty)
- [ ] README run steps work on a clean clone

Then STOP. **Do not push.** I will review the entire app myself and push manually.

### Phase 5: Deploy to Vercel (after Phase 4 passes)
1. `vercel.json`: only what is needed, plus `"crons": [{"path": "/api/cron/reconcile", "schedule": "0 0 * * *"}]` (cron runs on production deployments only; check my plan's cron limits in Vercel docs).
2. Env vars to set in Vercel (I do this in the dashboard, you list them): `DATABASE_URL` (Neon pooled, prod database), `STRIPE_SECRET_KEY` (test), `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`, `APP_BASE_URL`, `CRON_SECRET`.
3. Run migrations and seed against the **prod** Neon database **from my local machine** (`alembic upgrade head`, `python scripts/seed.py`). Never run migrations on Vercel startup.
4. Stripe test-mode Dashboard: register webhook endpoint `https://<project>.vercel.app/webhooks/stripe` for the 3 events, copy its `whsec_...` into Vercel env (this is different from the Stripe CLI secret used locally). Redeploy.
5. Verify live with curl: `/health`, double `/generate` with same key, forged webhook -> 400, test Checkout -> tenant becomes Pro.
6. README: add "Live demo" section with the URL, `/docs` link, a demo API key for a **demo tenant only** (never a real secret), and a 5-minute demo path. Paste live curl outputs into `EVIDENCE.md`.
7. Frontend: **none by default.** FastAPI's `/docs` (Swagger UI) is the demo UI. Only if I explicitly ask later, build ONE static page (dashboard showing `/usage`) with CORS configured; do not start it without my approval.

**Gate:** live URL passes the 5 acceptance probes. STOP.

## 5. Start now

Begin with **Phase 0**, report, and wait for `go phase 1`.
