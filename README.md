# Usage Metering & Billing Engine (FlyRank Capstone)

A production-grade, multi-tenant usage metering and subscription billing engine built with FastAPI, PostgreSQL (Neon), and Polar.sh sandbox.

## Overview

- **Multi-Tenant Metering:** Exact tracking of API calls and token usage (fresh input, cached input, output, reasoning).
- **Concurrency & Idempotency:** Guaranteed atomicity, quota boundary enforcement, and request deduplication.
- **Billing & Subscriptions:** Tiered plans (Free and Pro) with Polar sandbox webhook synchronization.
- **Pure Integer Math:** All monetary accounting handled strictly in micro-USD without floating-point inaccuracies.

## Why Polar and Not Stripe

Stripe is not available in Pakistan. To satisfy the assignment's subscription and webhook requirements faithfully without running into regional merchant onboarding barriers, the engine integrates with **Polar.sh sandbox** (`sandbox.polar.sh`). Polar is an open-source merchant of record offering developer-friendly hosted checkouts, monthly recurring subscriptions, and Standard Webhooks HMAC verification, mapping 1:1 to every Stripe concept in the original specification.

## Polar Local Setup

1. **Create an account:** Register on [sandbox.polar.sh](https://sandbox.polar.sh).
2. **Create an organization:** Set up a sandbox testing organization.
3. **Create product:** Under Products, create a recurring monthly product named "Pro" (e.g. $20/month). Copy the product ID into `.env` as `POLAR_PRO_PRODUCT_ID`.
4. **Create access token:** Go to Settings -> Developers -> Personal Access Tokens, create a token with sandbox scope, and paste it into `.env` as `POLAR_ACCESS_TOKEN`.
5. **Local webhooks:**
   - Polar sends webhooks signed according to the Standard Webhooks specification.
   - For local webhook delivery testing, you can forward events to `http://localhost:8000/webhooks/polar` using the Polar CLI (`polar listen --forward http://localhost:8000/webhooks/polar`) or test against a deployed Vercel endpoint.
   - Configure `POLAR_WEBHOOK_SECRET` in `.env`.
   - Sandbox test payments can use standard test card numbers provided in the Polar sandbox checkout interface (e.g. `4242 4242 4242 4242`).

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
