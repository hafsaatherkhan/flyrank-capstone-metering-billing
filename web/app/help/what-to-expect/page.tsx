import Link from "next/link";
import { ArrowLeft, Gauge, BarChart3, Receipt, ShieldCheck, Mail, Zap } from "lucide-react";

export default function WhatToExpectPage() {
  return (
    <div className="mx-auto max-w-[1140px] px-6 py-12 md:py-16">
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-full border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-2 text-xs font-semibold text-[var(--coffee)] shadow-sm transition-all hover:bg-[var(--coffee)] hover:text-[var(--coral)] hover:border-[var(--coffee)]"
      >
        <ArrowLeft size={14} /> Back to HisaabLedger
      </Link>

      <div className="my-10">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-color)] bg-[var(--coral-light)] px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--coral)]">
          Platform Capabilities
        </span>
        <h1 className="mt-4 font-grotesk text-[clamp(2.5rem,5vw,3.75rem)] font-semibold leading-tight tracking-[-0.04em] text-[var(--coffee)]">
          What to Expect
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
          A full walkthrough of every feature in HisaabLedger — what you get, how it works, and
          why it matters for AI cost control.
        </p>
      </div>

      {/* Feature grid */}
      <div className="mb-10 grid gap-6 md:grid-cols-2">
        {[
          {
            Icon: Gauge,
            title: "Live Token Metering",
            desc: "Every AI call is broken into prompt tokens, cached tokens, and completion tokens the moment it's ingested. No batching, no approximation — each request gets its own immutable ledger entry with a precise USD cost.",
            tag: "Core Feature",
          },
          {
            Icon: BarChart3,
            title: "4-Mode Analytics Switcher",
            desc: "The dashboard defaults to a Column chart but lets you switch to Line (trend over time), Horizontal Bar (model comparison), or Pie (cost share) with a single click — no page reload, no delay.",
            tag: "Dashboard",
          },
          {
            Icon: Receipt,
            title: "Per-Model Unit Pricing",
            desc: "HisaabLedger ships with pricing tables for GPT-4o, Claude 3.5 Sonnet, and Gemini 1.5 Pro. Input, cached, and output tokens are each priced independently at their real published rates.",
            tag: "Billing Engine",
          },
          {
            Icon: ShieldCheck,
            title: "Dual-Token Auth Sessions",
            desc: "Login returns both an Access Token (short-lived) and a Refresh Token (longer-lived). The client silently refreshes sessions — you stay logged in without re-authenticating every hour.",
            tag: "Neon Auth",
          },
          {
            Icon: Mail,
            title: "Automated Welcome Emails",
            desc: "New signups receive a branded onboarding email immediately on account creation via the FastAPI background email service — no manual trigger needed.",
            tag: "Onboarding",
          },
          {
            Icon: Zap,
            title: "Quota Enforcement",
            desc: "Set a monthly token quota for your tenant. When consumption approaches the limit, the metering engine enforces rate-limiting and flags overage events in the ledger with a distinct status code.",
            tag: "Controls",
          },
        ].map(({ Icon, title, desc, tag }) => (
          <div
            key={title}
            className="rounded-[1.75rem] border border-[var(--border-color)] bg-[var(--bg-card)] p-7 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--coral-light)] text-[var(--coral)]">
                <Icon size={20} />
              </div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--muted)] border border-[var(--border-color)] rounded-full px-2.5 py-1 mt-0.5">
                {tag}
              </span>
            </div>
            <h3 className="font-grotesk text-lg font-semibold tracking-[-0.02em] text-[var(--coffee)]">
              {title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{desc}</p>
          </div>
        ))}
      </div>

      {/* Timeline */}
      <section className="rounded-[2rem] border border-[var(--border-color)] bg-[var(--bg-card)] p-8 md:p-12 shadow-sm">
        <h2 className="font-grotesk text-2xl font-semibold tracking-[-0.03em] text-[var(--coffee)] mb-8">
          What happens when a call is ingested
        </h2>
        <ol className="relative space-y-8 border-l border-[var(--border-color)] pl-8">
          {[
            "POST request hits the FastAPI /ingest endpoint with tenant_id, model, and token counts.",
            "The pricing engine looks up per-token rates for prompt, cached, and output tokens.",
            "Total cost is calculated to 8 decimal places and stored with a UTC timestamp.",
            "The event is committed to PostgreSQL as an immutable ledger row.",
            "The tenant's cumulative usage counter is updated — quota check fires instantly.",
            "The event appears in the /events ledger view within milliseconds.",
          ].map((step, i) => (
            <li key={i} className="relative">
              <span className="absolute -left-[2.85rem] grid size-5 place-items-center rounded-full bg-[var(--coral)] text-white text-[10px] font-bold">
                {i + 1}
              </span>
              <p className="text-[15px] leading-relaxed text-[var(--muted)]">{step}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
