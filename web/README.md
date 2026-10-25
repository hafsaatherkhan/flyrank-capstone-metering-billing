# HisaabLedger Web UI & Portal

Reviewer and tenant portal interface for the FlyRank Metering & Billing engine, built with **Next.js 16 (App Router)**, **TypeScript**, and **Tailwind CSS**.

---

## Architecture & Layout

- **`app/connect/`**: Connect any tenant with their `X-API-Key` (stored strictly in `sessionStorage`) or 1-click test with `NEXT_PUBLIC_DEMO_API_KEY`.
- **`app/dashboard/`**: Real-time quota gauges (API calls & tokens) with warning (80%) and hard block (100%) thresholds, micro-USD breakdown, and Polar upgrade checkout button with auto-polling.
- **`app/playground/`**: Interactive `POST /generate` testing bench with simulated 4-tier token components, auto-generated idempotency keys, "Send Twice" replay verification, and formatted 200/402/429 status badges.
- **`app/events/`**: Tenant-isolated ledger table of recorded usage events.
- **`app/(auth)/`**: User management pages (`/login`, `/signup`, `/forgot-password`, `/change-password`) with 6-digit email OTP verification.
- **`app/help/` & `app/about/`**: Evaluator onboarding, FAQ, and technical expectations guide.
- **`components/AnalyticsChart.tsx`**: Interactive SVG chart visualizing consumption trends across billing periods.

---

## Local Development

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Configuration

Configure `web/.env.local` (safe public variables only):

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_DEMO_API_KEY=07dcfde3523d291c8cadd51c6fb9929923cf4478fb6e6e2e7aaa0bcf7b336032
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
```

---

## Production Build

```bash
npm run build
```
Generates statically optimized and prerendered routes.
