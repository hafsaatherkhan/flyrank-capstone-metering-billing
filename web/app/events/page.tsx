"use client";

import { useEffect, useState, useCallback } from "react";
import AuthGate from "@/components/AuthGate";
import { apiFetch } from "@/lib/api";
import { UsageEventItem } from "@/lib/types";
import { ListChecks, RefreshCw, AlertCircle, Database, Layers } from "lucide-react";

export default function EventsPage() {
  const [events, setEvents] = useState<UsageEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    setError(null);
    const res = await apiFetch<UsageEventItem[]>("/usage/events?limit=20");
    if (res.data) {
      setEvents(res.data);
    } else {
      setError(res.error || "Failed to load usage events.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return (
    <AuthGate>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--coffee)]">Usage Events</h1>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Immutable ledger of the latest 20 events recorded for this authenticated tenant.
            </p>
          </div>

          <button
            onClick={() => {
              setLoading(true);
              fetchEvents();
            }}
            disabled={loading}
            className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] hover:bg-[var(--bg-surface)] text-xs font-semibold text-[var(--text-main)] transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh Events</span>
          </button>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center text-[var(--text-muted)]">
            <div className="w-8 h-8 border-2 border-[var(--burgundy)] border-t-transparent rounded-full animate-spin mb-3" />
            <span className="text-xs">Loading ledger events...</span>
          </div>
        ) : events.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-muted)]">
            <Layers className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">No usage events found</p>
            <p className="text-xs mt-1">
              Trigger requests in the Playground to record your first metered events.
            </p>
          </div>
        ) : (
          <div className="rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-color)] bg-[var(--bg-surface)]/60 text-[var(--text-muted)] font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Event Type</th>
                    <th className="py-3 px-4">Quantity</th>
                    <th className="py-3 px-4">Token Breakdown (In / Cached / Out / Reasoning)</th>
                    <th className="py-3 px-4">Cost</th>
                    <th className="py-3 px-4">Idempotency Key</th>
                    <th className="py-3 px-4">Timestamp (UTC)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)] font-mono">
                  {events.map((ev) => (
                    <tr key={ev.id} className="hover:bg-[var(--bg-surface)]/40 transition-colors">
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                            ev.usage_type === "api_call"
                              ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                              : "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                          }`}
                        >
                          {ev.usage_type}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-[var(--coffee)]">
                        {ev.quantity.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-[11px] text-[var(--text-muted)]">
                        {ev.usage_type === "ai_tokens" ? (
                          <span>
                            {ev.token_breakdown.input_tokens} / {ev.token_breakdown.cached_input_tokens} /{" "}
                            {ev.token_breakdown.output_tokens} / {ev.token_breakdown.reasoning_tokens}
                          </span>
                        ) : (
                          <span className="opacity-40">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-[var(--burgundy)]">
                          {ev.cost_usd_display}
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)] block">
                          {ev.cost_micro_usd} µUSD
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[11px] text-[var(--text-muted)] truncate max-w-[140px]" title={ev.idempotency_key}>
                        {ev.idempotency_key}
                      </td>
                      <td className="py-3 px-4 text-[11px] text-[var(--text-muted)] whitespace-nowrap">
                        {new Date(ev.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AuthGate>
  );
}
