# Usage Metering & Billing Engine (FlyRank Capstone)

A production-grade, multi-tenant usage metering and subscription billing engine built with FastAPI, PostgreSQL (Neon), and Stripe.

## Overview

- **Multi-Tenant Metering:** Exact tracking of API calls and token usage (fresh input, cached input, output, reasoning).
- **Concurrency & Idempotency:** Guaranteed atomicity, quota boundary enforcement, and request deduplication.
- **Billing & Subscriptions:** Tiered plans (Free and Pro) with Stripe test-mode webhook synchronization.
- **Pure Integer Math:** All monetary accounting handled strictly in micro-USD without floating-point inaccuracies.

## Project Structure

```
app/
  main.py
  config.py
  db.py
  models.py
  schemas.py
  errors.py
  api/
  services/
  jobs/
migrations/
scripts/
tests/
docs/
```

## Setup & Running

Instructions will be detailed as phases progress.
