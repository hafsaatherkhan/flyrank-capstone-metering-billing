import Link from "next/link";
import { Gauge, Terminal, ListChecks, ShieldCheck, Zap, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center py-12 md:py-20 text-center">
      {/* Hero Badge */}
      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[var(--border-color)] bg-[var(--bg-surface)] text-xs font-semibold text-[var(--burgundy)] mb-6 animate-float">
        <Zap className="w-3.5 h-3.5 text-[var(--coral)]" />
        <span>Metering, Quotas & Polar Billing Capstone</span>
      </div>

      {/* Main Title */}
      <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-[var(--coffee)] max-w-3xl leading-[1.15]">
        Inspect Usage. <br />
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--burgundy)] via-[var(--coral)] to-[var(--burgundy)]">
          Enforce Quotas. Upgrade Live.
        </span>
      </h1>

      <p className="mt-5 text-base sm:text-lg text-[var(--text-muted)] max-w-xl leading-relaxed">
        A clean, reviewer-friendly interface for inspecting real-time token tracking, idempotency replay, quota gating (402/429), and seamless Polar checkout.
      </p>

      {/* Action buttons */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/connect"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--burgundy)] text-white font-medium text-sm hover:bg-[var(--burgundy-hover)] transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
        >
          <span>Connect API Key</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-main)] font-medium text-sm hover:border-[var(--coral)] transition-all"
        >
          <span>View Dashboard</span>
        </Link>
      </div>

      {/* Features preview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-16 text-left w-full max-w-4xl">
        <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xs transition-transform hover:-translate-y-1">
          <div className="w-10 h-10 rounded-xl bg-[var(--coral-light)] text-[var(--burgundy)] flex items-center justify-center mb-4">
            <Gauge className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-base mb-1">Live Quota Gauges</h3>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            Real-time visual progress bars changing color at 80% warning and 100% hard limit.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xs transition-transform hover:-translate-y-1">
          <div className="w-10 h-10 rounded-xl bg-[var(--coral-light)] text-[var(--burgundy)] flex items-center justify-center mb-4">
            <Terminal className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-base mb-1">Interactive Playground</h3>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            Fire requests with custom token weights, replay with identical idempotency keys, and observe 402/429 limits.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xs transition-transform hover:-translate-y-1">
          <div className="w-10 h-10 rounded-xl bg-[var(--coral-light)] text-[var(--burgundy)] flex items-center justify-center mb-4">
            <ListChecks className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-base mb-1">Tenant Event Logs</h3>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            Isolated event audit trail detailing micro-USD pricing, token components, and timestamps.
          </p>
        </div>
      </div>
    </div>
  );
}
