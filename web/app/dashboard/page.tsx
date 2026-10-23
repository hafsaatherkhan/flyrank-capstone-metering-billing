"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import AuthGate from "@/components/AuthGate";
import { apiFetch } from "@/lib/api";
import { UsageSummary, CheckoutResponse, TenantMe } from "@/lib/types";
import {
  Gauge,
  Zap,
  TrendingUp,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  Sparkles,
} from "lucide-react";

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs">Loading dashboard...</div>}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [pollingPro, setPollingPro] = useState(false);
  const [pollCount, setPollCount] = useState(0);

  const fetchUsage = useCallback(async () => {
    setError(null);
    const res = await apiFetch<UsageSummary>("/usage");
    if (res.data) {
      setUsage(res.data);
    } else {
      setError(res.error || "Failed to load current usage.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsage();

    // Check if returning from checkout
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("checkout") === "success") {
        setPollingPro(true);
      }
    }
  }, [fetchUsage]);

  // Polling after returning from checkout
  useEffect(() => {
    if (!pollingPro) return;

    const interval = setInterval(async () => {
      setPollCount((prev) => {
        if (prev >= 6) {
          setPollingPro(false);
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });

      const res = await apiFetch<TenantMe>("/me");
      if (res.data && res.data.plan.toLowerCase() === "pro") {
        setPollingPro(false);
        clearInterval(interval);
        fetchUsage();
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [pollingPro, fetchUsage]);

  const handleUpgrade = async () => {
    setUpgrading(true);
    setError(null);
    const res = await apiFetch<CheckoutResponse>("/checkout", {
      method: "POST",
    });

    if (res.data && res.data.checkout_url) {
      window.location.href = res.data.checkout_url;
    } else {
      setUpgrading(false);
      setError(res.error || "Failed to start checkout. Verify backend Polar configuration.");
    }
  };

  const getProgressColor = (used: number, limit: number) => {
    if (limit <= 0) return "bg-zinc-400";
    const pct = (used / limit) * 100;
    if (pct >= 100) return "bg-red-600";
    if (pct >= 80) return "bg-amber-500";
    return "bg-[var(--burgundy)]";
  };

  const calculatePct = (used: number, limit: number) => {
    if (limit <= 0) return 0;
    return Math.min(100, Math.round((used / limit) * 100));
  };

  return (
    <AuthGate>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-[var(--coffee)]">Usage Dashboard</h1>
              {usage && (
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                    usage.plan.toLowerCase() === "pro"
                      ? "bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                      : "bg-[var(--coral-light)] text-[var(--burgundy)] border border-[var(--coral)]/30"
                  }`}
                >
                  {usage.plan}
                </span>
              )}
              {usage && (
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                    usage.subscription_status === "active"
                      ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {usage.subscription_status}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Billing Period: {usage ? usage.period : "—"} • Multi-tenant Metering Rollup
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setLoading(true);
                fetchUsage();
              }}
              disabled={loading}
              className="p-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] hover:bg-[var(--bg-surface)] text-[var(--text-muted)] transition-colors"
              title="Refresh usage"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>

            {usage?.plan.toLowerCase() !== "pro" ? (
              <button
                onClick={handleUpgrade}
                disabled={upgrading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--burgundy)] hover:bg-[var(--burgundy-hover)] text-white text-xs font-semibold transition-all shadow-sm disabled:opacity-50"
              >
                {upgrading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    <span>Upgrade to Pro</span>
                  </>
                )}
              </button>
            ) : (
              <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-xs font-semibold">
                <Sparkles className="w-4 h-4 text-purple-500" />
                <span>Pro Subscriber</span>
              </div>
            )}
          </div>
        </div>

        {/* Polling Banner */}
        {pollingPro && (
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-amber-600" />
              <span>Verifying Polar checkout upgrade... (checking status attempt {pollCount}/6)</span>
            </div>
          </div>
        )}

        {/* Error notification */}
        {error && (
          <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Quota Progress Bars */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* API Calls Card */}
          <div className="p-6 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[var(--coral-light)] text-[var(--burgundy)] flex items-center justify-center">
                  <Gauge className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">API Calls Quota</h3>
                  <span className="text-[11px] text-[var(--text-muted)]">Per monthly period</span>
                </div>
              </div>
              <span className="font-mono text-xs font-bold text-[var(--coffee)]">
                {usage ? calculatePct(usage.api_calls.used, usage.api_calls.limit) : 0}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-[var(--bg-surface)] h-3 rounded-full overflow-hidden p-0.5 border border-[var(--border-color)]">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  usage
                    ? getProgressColor(usage.api_calls.used, usage.api_calls.limit)
                    : "bg-[var(--burgundy)]"
                }`}
                style={{
                  width: `${usage ? calculatePct(usage.api_calls.used, usage.api_calls.limit) : 0}%`,
                }}
              />
            </div>

            <div className="flex justify-between items-center mt-3 text-xs">
              <span className="text-[var(--text-muted)] font-mono">
                Used: <strong className="text-[var(--text-main)]">{usage ? usage.api_calls.used.toLocaleString() : "—"}</strong>
              </span>
              <span className="text-[var(--text-muted)] font-mono">
                Limit: <strong className="text-[var(--text-main)]">{usage ? usage.api_calls.limit.toLocaleString() : "—"}</strong>
              </span>
            </div>
          </div>

          {/* AI Tokens Card */}
          <div className="p-6 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[var(--coral-light)] text-[var(--burgundy)] flex items-center justify-center">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">AI Tokens Quota</h3>
                  <span className="text-[11px] text-[var(--text-muted)]">Sum of all 4 token tiers</span>
                </div>
              </div>
              <span className="font-mono text-xs font-bold text-[var(--coffee)]">
                {usage ? calculatePct(usage.ai_tokens.used, usage.ai_tokens.limit) : 0}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-[var(--bg-surface)] h-3 rounded-full overflow-hidden p-0.5 border border-[var(--border-color)]">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  usage
                    ? getProgressColor(usage.ai_tokens.used, usage.ai_tokens.limit)
                    : "bg-[var(--burgundy)]"
                }`}
                style={{
                  width: `${usage ? calculatePct(usage.ai_tokens.used, usage.ai_tokens.limit) : 0}%`,
                }}
              />
            </div>

            <div className="flex justify-between items-center mt-3 text-xs">
              <span className="text-[var(--text-muted)] font-mono">
                Used: <strong className="text-[var(--text-main)]">{usage ? usage.ai_tokens.used.toLocaleString() : "—"}</strong>
              </span>
              <span className="text-[var(--text-muted)] font-mono">
                Limit: <strong className="text-[var(--text-main)]">{usage ? usage.ai_tokens.limit.toLocaleString() : "—"}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Cost Breakdown */}
        <div className="p-6 sm:p-8 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xs">
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-9 h-9 rounded-xl bg-[var(--coral-light)] text-[var(--burgundy)] flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Period Cost Breakdown</h3>
              <p className="text-xs text-[var(--text-muted)]">
                Calculated in micro-USD from immutable usage event records
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)]">
              <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                API Calls Cost
              </span>
              <div className="mt-2 text-xl font-bold font-mono text-[var(--coffee)]">
                ${usage ? (usage.cost.api_calls_micro_usd / 1_000_000).toFixed(6) : "0.000000"}
              </div>
              <span className="text-[10px] text-[var(--text-muted)] font-mono">
                {usage ? usage.cost.api_calls_micro_usd.toLocaleString() : 0} µUSD
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)]">
              <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Token Cost
              </span>
              <div className="mt-2 text-xl font-bold font-mono text-[var(--coffee)]">
                ${usage ? (usage.cost.tokens_micro_usd / 1_000_000).toFixed(6) : "0.000000"}
              </div>
              <span className="text-[10px] text-[var(--text-muted)] font-mono">
                {usage ? usage.cost.tokens_micro_usd.toLocaleString() : 0} µUSD
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--coral-light)] border border-[var(--coral)]/40">
              <span className="text-[11px] font-semibold text-[var(--burgundy)] uppercase tracking-wider">
                Total Accrued Cost
              </span>
              <div className="mt-2 text-2xl font-bold font-mono text-[var(--burgundy)]">
                {usage ? usage.cost.total_usd_display : "$0.000000"}
              </div>
              <span className="text-[10px] text-[var(--text-muted)] font-mono">
                {usage ? usage.cost.total_micro_usd.toLocaleString() : 0} µUSD
              </span>
            </div>
          </div>
        </div>
      </div>
    </AuthGate>
  );
}
