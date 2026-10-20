# Architecture & System Design

## 1. Problem Statement
Multi-tenant AI platforms face revenue leakage and billing disputes when usage metering lacks transactionality and idempotency. Concurrent AI generation requests can bypass plan rate and token allowances without row-level synchronization. This service provides guaranteed exactly-once usage recording, atomic quota enforcement, and automated subscription status synchronization with Stripe.

## 2. Data Model & Indexing Strategy
PostgreSQL schema implemented via SQLAlchemy/Alembic on Neon:

- **`plans`**: Catalog of subscription tiers.
  - Columns: `id` (INT PK), `name` (VARCHAR UNIQUE), `api_calls_limit` (INT), `ai_tokens_limit` (INT), `stripe_price_id` (VARCHAR NULLABLE)
- **`tenants`**: Registered tenants and their active tier assignment.
  - Columns: `id` (UUID PK), `name` (VARCHAR), `api_key_hash` (CHAR(64) UNIQUE NOT NULL), `plan_id` (INT FK `plans.id`), `subscription_status` (VARCHAR NOT NULL DEFAULT 'active'), `stripe_customer_id` (VARCHAR UNIQUE NULLABLE), `created_at` (TIMESTAMPTZ)
  - Index: `UNIQUE(api_key_hash)`
- **`subscriptions`**: Stripe recurring subscription state mirror.
  - Columns: `id` (UUID PK), `tenant_id` (UUID FK `tenants.id`), `stripe_subscription_id` (VARCHAR UNIQUE NOT NULL), `status` (VARCHAR NOT NULL), `current_period_end` (TIMESTAMPTZ)
  - Index: `UNIQUE(stripe_subscription_id)`, `INDEX(tenant_id)`
- **`idempotency_keys`**: HTTP payload and response cache for exactly-once processing.
  - Columns: `tenant_id` (UUID FK `tenants.id`), `key` (VARCHAR), `request_hash` (CHAR(64) NOT NULL), `response_status` (INT NOT NULL), `response_body` (JSONB NOT NULL), `created_at` (TIMESTAMPTZ)
  - Constraints & Indexes: `PRIMARY KEY (tenant_id, key)`
- **`usage_events`**: Immutable ledger of discrete consumption events.
  - Columns: `id` (UUID PK), `tenant_id` (UUID FK `tenants.id`), `usage_type` (VARCHAR: `'api_call'` | `'ai_tokens'`), `quantity` (INT NOT NULL), `input_tokens` (INT DEFAULT 0), `cached_input_tokens` (INT DEFAULT 0), `output_tokens` (INT DEFAULT 0), `reasoning_tokens` (INT DEFAULT 0), `cost_micro_usd` (BIGINT NOT NULL), `idempotency_key` (VARCHAR NOT NULL), `period_start` (TIMESTAMPTZ NOT NULL), `created_at` (TIMESTAMPTZ NOT NULL)
  - Constraints & Indexes: `UNIQUE (tenant_id, idempotency_key, usage_type)`, `INDEX (tenant_id, period_start, usage_type)`
- **`stripe_events`**: Audit table ensuring webhook idempotency.
  - Columns: `event_id` (VARCHAR PRIMARY KEY), `type` (VARCHAR NOT NULL), `received_at` (TIMESTAMPTZ NOT NULL), `processed_at` (TIMESTAMPTZ NOT NULL)

## 3. API Contract
- `POST /generate`: Authenticated generation entrypoint (`X-API-Key`, `Idempotency-Key`). Validates quota, records usage atomically, returns generated text + usage details.
- `GET /usage`: Authenticated report for the tenant's current calendar month: consumed vs. limit for calls and tokens.
- `POST /checkout`: Authenticated endpoint initiating Stripe checkout session (mode=subscription) for Pro tier upgrade.
- `POST /webhooks/stripe`: Validates raw webhook signatures (`Stripe-Signature`), records event ID, updates tenant/subscription tiers.
- `GET /health`: Liveness and DB connectivity check.

## 4. Idempotency Strategy
1. **Lookup**: On receipt of `Idempotency-Key`, look up `idempotency_keys` under `(tenant_id, key)`.
2. **Payload Check**: If entry exists, SHA-256 hash the incoming normalized JSON body and compare with `request_hash`.
   - Matching hash: Return cached `response_status` and `response_body` with header `Idempotent-Replayed: true`.
   - Mismatched hash: Terminate immediately with `409 Conflict` (`idempotency_key_reused`).
3. **Write & Guard**: If entry does not exist, execute the operation and store both `usage_events` and the completed `idempotency_keys` record in the same database transaction. The `UNIQUE(tenant_id, idempotency_key, usage_type)` constraint serves as the final concurrency lock.

## 5. Concurrency & Quota Enforcement
To prevent race conditions during concurrent requests near quota boundaries:
1. Every metering check opens a transaction and acquires a pessimistic row lock:
   `SELECT * FROM tenants WHERE id = :tenant_id FOR UPDATE`
2. Total usage is aggregated for the active calendar month (`period_start = DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC')`).
3. **Boundary Rule**: A request is granted if and only if `used + requested <= limit` for both `api_call` and `ai_tokens`.
   - Free plan exceeding quota yields **402 Payment Required**.
   - Pro plan exceeding quota yields **429 Too Many Requests** with `Retry-After` header.
   - All-or-nothing: if either calls or tokens would exceed limits, no usage event is committed.

## 6. Status Code Contract
| Situation | Status | Body / Headers |
|---|---|---|
| Missing/invalid API key | 401 | `{"error": "invalid_api_key", "message": "..."}` |
| Invalid payload | 422 | Clean validation error details |
| Same idempotency key + different payload | 409 | `{"error": "idempotency_key_reused", "message": "..."}` |
| Same idempotency key + same payload | Original | Cached body + `Idempotent-Replayed: true` |
| Free plan over quota | 402 | `{"error": "quota_exceeded", "used": ..., "limit": ..., "requested": ..., "upgrade": "..."}` |
| Pro plan over quota | 429 | `quota_exceeded` payload + `Retry-After: <seconds>` |
| Subscription `past_due` / `canceled` | 402 | `{"error": "payment_required", "message": "..."}` |
| Forged/invalid webhook signature | 400 | Signature verification error |
| Duplicate webhook event | 200 | `{"status": "duplicate_ignored"}` |

## 7. Layer Sketch
```
[Client / Stripe Webhook]
           │
           ▼
[FastAPI Routers (app/api/)]
           │ (Validate Auth, Idempotency Header, Schemas)
           ▼
[Domain Services (app/services/)]
   ├── quota.py        <-- Lock tenant & check monthly limits
   ├── metering.py     <-- Atomic usage event ledger insertion
   ├── pricing.py      <-- Micro-USD token calculations
   └── stripe_sync.py  <-- Customer, session & subscription state mapping
           │
           ▼
[Data Layer (SQLAlchemy 2.x + Neon PostgreSQL)]
```

## 8. Explicit Non-Goals
- No custom invoice generation or PDF rendering.
- No mid-cycle proration calculations or partial credit adjustments.
- No pay-as-you-go overage billing (hard quota enforcement per tier).
