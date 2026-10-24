import Link from "next/link";
import { Gauge, Terminal, ListChecks, ShieldCheck, Zap, ArrowRight, BarChart3, UserPlus, LogIn } from "lucide-react";
import HisaabLedgerLogo from "@/components/HisaabLedgerLogo";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center py-12 md:py-20 text-center">
      {/* Brand Hero Badge */}
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/70 dark:bg-indigo-950/40 text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-6 animate-float">
        <Zap className="w-3.5 h-3.5 text-amber-500" />
        <span>HisaabLedger • Precision AI Metering & Accounting Intelligence</span>
      </div>

      {/* Main Title */}
      <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-[var(--coffee)] max-w-3xl leading-[1.15]">
        Inspect Usage. <br />
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 via-indigo-600 to-indigo-800">
          Enforce Quotas. Power Accounting.
        </span>
      </h1>

      <p className="mt-5 text-base sm:text-lg text-[var(--text-muted)] max-w-xl leading-relaxed">
        <strong>HisaabLedger</strong> delivers real-time AI token tracking, interactive chart visualizations (Column, Bar, Line, Pie), automated welcome emails, and session authentication.
      </p>

      {/* Action buttons */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/signup"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-medium text-sm hover:from-indigo-700 hover:to-indigo-800 transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
        >
          <UserPlus className="w-4 h-4" />
          <span>Get Started (Sign Up)</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--coffee)] font-medium text-sm hover:border-indigo-400 transition-all"
        >
          <LogIn className="w-4 h-4" />
          <span>Login</span>
        </Link>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-main)] font-medium text-sm hover:border-indigo-400 transition-all"
        >
          <BarChart3 className="w-4 h-4 text-indigo-500" />
          <span>Live Analytics</span>
        </Link>
      </div>

      {/* Features preview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-16 text-left w-full max-w-4xl">
        <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xs transition-transform hover:-translate-y-1">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4">
            <BarChart3 className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-base mb-1 text-[var(--coffee)]">Real Analytics Switcher</h3>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            Switch smoothly between Column (default), Line, Horizontal Bar, and Pie charts via intuitive dropdown or 3-dots menu.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xs transition-transform hover:-translate-y-1">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-base mb-1 text-[var(--coffee)]">Neon Auth & Security</h3>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            Dual token session management (Access & Refresh tokens), password change/recovery, and Google single-sign-on.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xs transition-transform hover:-translate-y-1">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
            <Terminal className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-base mb-1 text-[var(--coffee)]">Precision Accounting</h3>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            Sub-cent USD calculation, input/cached/output token isolation, and automated welcome email onboarding.
          </p>
        </div>
      </div>
    </div>
  );
}
