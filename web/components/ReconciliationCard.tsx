"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  ShieldAlert,
  Server,
  Zap,
} from "lucide-react";

interface ReconcileSummary {
  status?: string;
  run_id?: string;
  checked?: number;
  mismatched?: number;
  errored?: number;
  aborted?: boolean;
  reason?: string;
  message?: string;
}

export default function ReconciliationCard() {
  const [loading, setLoading] = useState(false);
  const [asyncMode, setAsyncMode] = useState(false);
  const [result, setResult] = useState<ReconcileSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastTriggered, setLastTriggered] = useState<string | null>(null);

  const handleRunReconcile = async () => {
    setLoading(true);
    setError(null);

    const endpoint = `/api/cron/reconcile?sync=${asyncMode ? "false" : "true"}`;
    const res = await apiFetch<ReconcileSummary>(endpoint, {
      method: "GET",
    });

    setLoading(false);
    setLastTriggered(new Date().toLocaleTimeString());

    if (res.data) {
      setResult(res.data);
    } else {
      setError(res.error || "Failed to execute reconciliation job.");
    }
  };

  return (
    <div className="p-6 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xs space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[var(--border-color)] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-[var(--coral)]" />
            <h2 className="text-sm font-bold text-[var(--coffee)] tracking-tight">
              Background Subscription Reconciliation Job
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-mono text-[10px] font-bold border border-emerald-200 dark:border-emerald-800">
              FlyRank Capstone
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Reconciles local subscriptions against live Polar provider state with bounded exponential retries &amp; failure alerts.
          </p>
        </div>

        {/* Execution Mode Toggle */}
        <div className="flex items-center gap-2 bg-[var(--bg-base)] p-1 rounded-xl border border-[var(--border-color)]">
          <button
            type="button"
            onClick={() => setAsyncMode(false)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
              !asyncMode
                ? "bg-[var(--coral-light)] text-[var(--coral)] shadow-xs"
                : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
            }`}
          >
            Direct Sync
          </button>
          <button
            type="button"
            onClick={() => setAsyncMode(true)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
              asyncMode
                ? "bg-[var(--coral-light)] text-[var(--coral)] shadow-xs"
                : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
            }`}
            title="Runs asynchronously via FastAPI BackgroundTasks off the HTTP request path"
          >
            Async Worker
          </button>
        </div>
      </div>

      {/* Security & Architecture Specs Badge */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="p-3 rounded-2xl bg-[var(--bg-base)] border border-[var(--border-color)] flex items-start gap-2.5">
          <Zap className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-[var(--coffee)] block">Bounded Retries</span>
            <span className="text-[11px] text-[var(--text-muted)]">3 retries + full jitter + 429 Retry-After</span>
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-[var(--bg-base)] border border-[var(--border-color)] flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-[var(--coral)] shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-[var(--coffee)] block">Structured Alerts</span>
            <span className="text-[11px] text-[var(--text-muted)]">Deduplicated failure events emitted on exhaust</span>
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-[var(--bg-base)] border border-[var(--border-color)] flex items-start gap-2.5">
          <Server className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-[var(--coffee)] block">Secure Isolation</span>
            <span className="text-[11px] text-[var(--text-muted)]">Authenticated trigger, non-blocking lock</span>
          </div>
        </div>
      </div>

      {/* Action Button & Run Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <button
          type="button"
          onClick={handleRunReconcile}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--coral)] hover:bg-[var(--coral)]/90 text-white font-semibold text-xs transition-all shadow-sm active:scale-98 disabled:opacity-50"
        >
          {loading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4 fill-current" />
          )}
          <span>{loading ? "Reconciling..." : "Trigger Background Reconciliation"}</span>
        </button>

        {lastTriggered && (
          <span className="text-[11px] text-[var(--text-muted)] font-mono">
            Last execution: {lastTriggered}
          </span>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Live Result State */}
      {result && (
        <div className="p-4 rounded-2xl bg-[var(--bg-base)] border border-[var(--border-color)] space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-[var(--coffee)] flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Execution Summary</span>
            </span>
            {result.run_id && (
              <span className="font-mono text-[11px] text-[var(--text-muted)]">
                Run ID: <strong className="text-[var(--coffee)]">{result.run_id}</strong>
              </span>
            )}
          </div>

          {result.status === "accepted" ? (
            <p className="text-xs text-sky-600 dark:text-sky-400 font-medium">
              Job enqueued successfully! Running off the request path in the background.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center pt-1 font-mono text-xs">
              <div className="p-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)]">
                <span className="text-[10px] text-[var(--text-muted)] block uppercase">Checked</span>
                <span className="text-sm font-bold text-[var(--coffee)]">{result.checked ?? 0}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)]">
                <span className="text-[10px] text-[var(--text-muted)] block uppercase">Mismatched</span>
                <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                  {result.mismatched ?? 0}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)]">
                <span className="text-[10px] text-[var(--text-muted)] block uppercase">Errored / Retried</span>
                <span className="text-sm font-bold text-red-600 dark:text-red-400">
                  {result.errored ?? 0}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)]">
                <span className="text-[10px] text-[var(--text-muted)] block uppercase">Status</span>
                <span
                  className={`text-xs font-bold uppercase ${
                    result.aborted ? "text-amber-500" : "text-emerald-500"
                  }`}
                >
                  {result.aborted ? result.reason || "Aborted" : "Completed"}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
