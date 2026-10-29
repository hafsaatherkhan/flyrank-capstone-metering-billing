import Link from "next/link";
import { ArrowLeft, Zap, BarChart3, ShieldCheck } from "lucide-react";

export default function AboutPage() {
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
          <Zap size={11} /> Internship Capstone Story
        </span>
        <h1 className="mt-4 font-grotesk text-[clamp(2.5rem,5vw,3.75rem)] font-semibold leading-tight tracking-[-0.04em] text-[var(--coffee)]">
          About HisaabLedger
        </h1>
        <p className="mt-4 max-w-3xl text-lg leading-relaxed text-[var(--muted)]">
          A precision AI metering and cost-accounting platform built to give engineers and product
          teams complete visibility into every token consumed, every dollar spent, and every quota enforced.
        </p>
      </div>

      <section className="mb-10 rounded-[2rem] border border-[var(--border-color)] bg-[var(--bg-card)] p-8 md:p-12 shadow-sm">
        <h2 className="font-grotesk text-2xl font-semibold tracking-[-0.03em] text-[var(--coffee)]">
          Creator &amp; Capstone Background
        </h2>
        <p className="mt-4 text-[15px] leading-relaxed text-[var(--text-muted)]">
          HisaabLedger was designed and developed by{" "}
          <a
            href="https://www.linkedin.com/in/hafsa-ather-khan"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[var(--coral)] hover:underline"
          >
            Hafsa Ather Khan
          </a>{" "}
          as a full-stack Internship Capstone project for the FlyRank Internship 2026. The
          mission: make AI token consumption entirely transparent — from raw model calls to auditable
          financial ledgers that map every dollar back to a tenant, model, and timestamp.
        </p>
        <p className="mt-4 text-[15px] leading-relaxed text-[var(--text-muted)]">
          Most platforms treat AI cost as an afterthought. HisaabLedger puts metering at the centre —
          recording prompt tokens, cached tokens, and completion tokens separately, applying
          per-model unit pricing, and surfacing the result as interactive analytics your whole team
          can interrogate.
        </p>
      </section>

      <section className="mb-14 grid gap-6 md:grid-cols-3">
        {[
          {
            Icon: Zap,
            iconBg: "bg-[var(--coral-light)]",
            iconColor: "text-[var(--coral)]",
            title: "Real-Time Metering",
            desc: "Every AI call is recorded the moment it lands — input, cached, and output tokens tracked separately with sub-cent USD precision.",
          },
          {
            Icon: BarChart3,
            iconBg: "bg-[var(--bg-surface)]",
            iconColor: "text-[var(--coffee)]",
            title: "4-Mode Analytics",
            desc: "Column, Line, Horizontal Bar, and Pie charts with instant date-range switching so you can slice cost any way you need.",
          },
          {
            Icon: ShieldCheck,
            iconBg: "bg-[var(--coral-light)]",
            iconColor: "text-[var(--coral)]",
            title: "Neon Auth Security",
            desc: "Dual Access & Refresh token sessions, secure password recovery flows, and Google SSO — all built into the platform.",
          },
        ].map(({ Icon, iconBg, iconColor, title, desc }) => (
          <div
            key={title}
            className="rounded-[1.75rem] border border-[var(--border-color)] bg-[var(--bg-card)] p-7 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
          >
            <div className={`mb-5 grid size-11 place-items-center rounded-2xl ${iconBg} ${iconColor}`}>
              <Icon size={20} />
            </div>
            <h3 className="font-grotesk text-lg font-semibold tracking-[-0.02em] text-[var(--coffee)]">
              {title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{desc}</p>
          </div>
        ))}
      </section>

      <section className="rounded-[2rem] border border-[var(--border-color)] bg-[var(--bg-card)] p-8 md:p-12 shadow-sm">
        <h2 className="font-grotesk text-2xl font-semibold tracking-[-0.03em] text-[var(--coffee)]">
          Technology Stack
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[
            ["Frontend", "Next.js 16, React 19, Tailwind CSS v4, Framer Motion, Recharts"],
            ["Backend", "FastAPI (Python), Uvicorn, Alembic migrations"],
            ["Database", "PostgreSQL on Neon — serverless, branching-ready"],
            ["Auth", "Neon Auth — dual token sessions, Google OAuth, password recovery"],
            ["Infrastructure", "Vercel (frontend), Neon (database), automated cron billing jobs"],
            ["Metering", "Per-call token ingestion, per-model pricing engine, quota enforcement"],
          ].map(([label, detail]) => (
            <div key={label} className="rounded-xl border border-[var(--border-color)] p-4">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--coral)] mb-1">
                {label}
              </p>
              <p className="text-sm text-[var(--muted)] leading-relaxed">{detail}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
