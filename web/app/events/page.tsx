"use client";

import { useEffect, useState, useCallback } from "react";
import AuthGate from "@/components/AuthGate";
import { apiFetch } from "@/lib/api";
import { UsageEventItem } from "@/lib/types";
import AnalyticsChart from "@/components/AnalyticsChart";
import { ListChecks, RefreshCw, AlertCircle, Database, Layers, BarChart2 } from "lucide-react";

export default function EventsPage() {
  const [events, setEvents] = useState<UsageEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    setError(null);
    const res = await apiFetch<UsageEventItem[]>("/usage/events?limit=25");
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

  // Aggregate Real Event Ledger Timeline Analytics
  const eventTimelineData = [...events]
    .reverse()
    .slice(-10)
    .map((ev, idx) => ({
      name: `#${idx + 1} (${ev.usage_type.replace('_', ' ')})`,
      value: ev.quantity,
      secondary: Math.round(ev.cost_micro_usd / 10),
      color: ev.usage_type === "api_call" ? "#4f46e5" : "#f59e0b",
    }));

  return (
    <AuthGate>
      <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--coffee)]">
              Ledger Events & Audit Trail
            </h1>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Immutable ledger of events recorded for this tenant in Neon PostgreSQL.
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

        {/* Ledger Real Analytics View */}
        {events.length > 0 && (
          <div className="mb-6">
            <AnalyticsChart
              title="Recent Ledger Invocations & Volume"
              subtitle="Sequence of latest transaction loads across API calls and tokens. Switch views with the dropdown or 3-dots icon."
              data={
                eventTimelineData.length > 0
                  ? eventTimelineData
                  : [
                      { name: "Tx 1", value: 1, color: "#4f46e5" },
                      { name: "Tx 2", value: 250, color: "#f59e0b" },
                    ]
              }
              primaryKeyLabel="Quantity"
            />
          </div>
        )}

        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center text-[var(--text-muted)]">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
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
                    <th className="py-3 px-4">Token Breakdown</th>
                    <th className="py-3 px-4">Cost (USD)</th>
                    <th className="py-3 px-4">Idempotency Key</th>
                    <th className="py-3 px-4">Timestamp (UTC)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {events.map((ev) => (
                    <tr key={ev.id} className="hover:bg-[var(--bg-surface)]/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-[var(--coffee)]">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider ${
                            ev.usage_type === "api_call"
                              ? "bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400"
                              : "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400"
                          }`}
                        >
                          {ev.usage_type}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-[var(--coffee)]">
                        {ev.quantity.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-[var(--text-muted)]">
                        {ev.usage_type === "ai_tokens" ? (
                          <div className="flex items-center gap-1.5 flex-wrap font-mono text-[11px]">
                            <span title="Input">in:{ev.token_breakdown.input_tokens}</span>
                            <span>•</span>
                            <span title="Cached">cached:{ev.token_breakdown.cached_input_tokens}</span>
                            <span>•</span>
                            <span title="Output">out:{ev.token_breakdown.output_tokens}</span>
                            <span>•</span>
                            <span title="Reasoning">rsn:{ev.token_breakdown.reasoning_tokens}</span>
                          </div>
                        ) : (
                          <span className="text-[var(--text-muted)] opacity-60">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-emerald-600 dark:text-emerald-400">
                        {ev.cost_usd_display}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-[var(--text-muted)] max-w-[140px] truncate" title={ev.idempotency_key}>
                        {ev.idempotency_key}
                      </td>
                      <td className="py-3 px-4 text-[var(--text-muted)] whitespace-nowrap">
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
