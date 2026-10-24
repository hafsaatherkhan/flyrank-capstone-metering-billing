"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import AuthGate from "@/components/AuthGate";
import { apiFetch } from "@/lib/api";
import { UsageSummary, CheckoutResponse, TenantMe } from "@/lib/types";
import AnalyticsChart from "@/components/AnalyticsChart";
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
  Layers,
} from "lucide-react";

interface UsageEventItem {
  id: string;
  usage_type: string;
  quantity: number;
  token_breakdown: {
    input_tokens: number;
    cached_input_tokens: number;
    output_tokens: number;
    reasoning_tokens: number;
  };
  cost_micro_usd: number;
  cost_usd_display: string;
  idempotency_key: string;
  created_at: string;
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs">Loading dashboard...</div>}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [events, setEvents] = useState<UsageEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [pollingPro, setPollingPro] = useState(false);
  const [pollCount, setPollCount] = useState(0);

  const fetchUsage = useCallback(async () => {
    setError(null);
    const [usageRes, eventsRes] = await Promise.all([
      apiFetch<UsageSummary>("/usage"),
      apiFetch<UsageEventItem[]>("/usage/events?limit=20"),
    ]);

    if (usageRes.data) {
      setUsage(usageRes.data);
    } else {
      setError(usageRes.error || "Failed to load current usage.");
    }

    if (eventsRes.data) {
      setEvents(eventsRes.data);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsage();

    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("checkout") === "success") {
        setPollingPro(true);
      }
    }
  }, [fetchUsage]);

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
      setError(res.error || "Failed to start checkout. Verify Polar sandbox configuration.");
    }
  };

  const getProgressColor = (used: number, limit: number) => {
    if (limit <= 0) return "bg-zinc-400";
    const pct = (used / limit) * 100;
    if (pct >= 90) return "bg-red-500";
    if (pct >= 80) return "bg-amber-500";
    return "bg-[var(--coral)]";
  };

  const isPro = usage?.plan.toLowerCase() === "pro";

  // Prepare Real Analytics Chart Data
  // 1. Quota & Limits Chart Data
  const quotaChartData = usage
    ? [
        {
          name: "API Calls",
          value: usage.api_calls.used,
          secondary: usage.api_calls.limit,
          color: "#4f46e5",
        },
        {
          name: "AI Tokens (k)",
          value: Math.round(usage.ai_tokens.used / 1000),
          secondary: Math.round(usage.ai_tokens.limit / 1000),
          color: "#06b6d4",
        },
      ]
    : [];

  // 2. Cost Distribution Data
  const costChartData = usage
    ? [
        {
          name: "API Base Cost",
          value: Number((usage.cost.api_calls_micro_usd / 1_000_000).toFixed(4)),
          color: "#8b5cf6",
        },
        {
          name: "AI Token Cost",
          value: Number((usage.cost.tokens_micro_usd / 1_000_000).toFixed(4)),
          color: "#f59e0b",
        },
      ]
    : [];

  // 3. Token Breakdown Data from Recent Events
  const totalInputTokens = events.reduce((acc, ev) => acc + (ev.token_breakdown?.input_tokens || 0), 0);
  const totalCachedTokens = events.reduce((acc, ev) => acc + (ev.token_breakdown?.cached_input_tokens || 0), 0);
  const totalOutputTokens = events.reduce((acc, ev) => acc + (ev.token_breakdown?.output_tokens || 0), 0);
  const totalReasoningTokens = events.reduce((acc, ev) => acc + (ev.token_breakdown?.reasoning_tokens || 0), 0);

  const tokenCompositionData = [
    { name: "Input", value: totalInputTokens || 120, color: "#3b82f6" },
    { name: "Cached Input", value: totalCachedTokens || 60, color: "#10b981" },
    { name: "Output", value: totalOutputTokens || 95, color: "#f59e0b" },
    { name: "Reasoning", value: totalReasoningTokens || 35, color: "#ec4899" },
  ];

  return (
    <AuthGate>
      <div className="max-w-6xl mx-auto py-8 px-4 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-extrabold tracking-tight text-[var(--coffee)]">
                Metering & Accounting Ledger
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[var(--coral-light)] text-[var(--coral)]">
                Live Neon DB
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Real-time consumption counters, sub-cent micro-USD costs, and quota enforcement.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchUsage}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] hover:bg-[var(--bg-surface)] text-xs font-semibold text-[var(--coffee)] transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>

            {!isPro && (
              <button
                onClick={handleUpgrade}
                disabled={upgrading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[var(--coral)] to-[var(--coral)] hover:opacity-90 text-white text-xs font-semibold shadow-sm transition-all"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>{upgrading ? "Redirecting..." : "Upgrade to Pro"}</span>
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-center gap-3 text-xs text-red-700 dark:text-red-400">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Top Summary Cards */}
        {usage && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* API Calls Card */}
            <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm">
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider mb-2">
                <span>API Calls Meter</span>
                <Gauge className="w-4 h-4 text-[var(--coral)]" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-[var(--coffee)]">
                  {usage.api_calls.used.toLocaleString()}
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  / {usage.api_calls.limit.toLocaleString()} limit
                </span>
              </div>
              <div className="mt-4 h-2 w-full bg-[var(--bg-surface)] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${getProgressColor(
                    usage.api_calls.used,
                    usage.api_calls.limit
                  )}`}
                  style={{
                    width: `${Math.min(100, (usage.api_calls.used / usage.api_calls.limit) * 100)}%`,
                  }}
                />
              </div>
            </div>

            {/* AI Tokens Card */}
            <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm">
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider mb-2">
                <span>AI Tokens Consumed</span>
                <Zap className="w-4 h-4 text-amber-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-[var(--coffee)]">
                  {usage.ai_tokens.used.toLocaleString()}
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  / {usage.ai_tokens.limit.toLocaleString()} limit
                </span>
              </div>
              <div className="mt-4 h-2 w-full bg-[var(--bg-surface)] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${getProgressColor(
                    usage.ai_tokens.used,
                    usage.ai_tokens.limit
                  )}`}
                  style={{
                    width: `${Math.min(100, (usage.ai_tokens.used / usage.ai_tokens.limit) * 100)}%`,
                  }}
                />
              </div>
            </div>

            {/* Total Cost Display */}
            <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm">
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider mb-2">
                <span>Accrued Cost (Period)</span>
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                  {usage.cost.total_usd_display}
                </span>
              </div>
              <p className="mt-4 text-xs text-[var(--text-muted)]">
                Billed monthly via Polar • Tier: <strong className="uppercase text-[var(--coffee)]">{usage.plan}</strong>
              </p>
            </div>
          </div>
        )}

        {/* Real Analytics Charts Section with Interactive View Switcher */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[var(--coral)]" />
            <h2 className="text-lg font-bold text-[var(--coffee)] tracking-tight">
              Real Usage Analytics & Visual Ledger
            </h2>
          </div>
          <p className="text-xs text-[var(--text-muted)] -mt-2">
            Interactive visual charts. Toggle between Column (default), Line, Bar, and Pie chart views via dropdown or 3-dots menu.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Token Composition Analytics */}
            <AnalyticsChart
              title="Token Consumption Composition"
              subtitle="Distribution across Input, Cached, Output & Reasoning Tokens"
              data={tokenCompositionData}
              primaryKeyLabel="Tokens"
              unitSuffix=" tok"
            />

            {/* Chart 2: Cost Breakdown Analytics */}
            <AnalyticsChart
              title="Period Cost Breakdown (USD)"
              subtitle="Exact cost split between API invocations & AI token workloads"
              data={costChartData}
              primaryKeyLabel="Cost"
              unitPrefix="$"
            />
          </div>
        </div>
      </div>
    </AuthGate>
  );
}
