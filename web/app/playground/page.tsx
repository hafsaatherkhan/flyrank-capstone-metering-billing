"use client";

import { useState, useEffect } from "react";
import AuthGate from "@/components/AuthGate";
import ReconciliationCard from "@/components/ReconciliationCard";
import { apiFetch } from "@/lib/api";
import { GenerateRequestPayload } from "@/lib/types";
import {
  Terminal,
  Send,
  Copy,
  RefreshCw,
  Repeat,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
} from "lucide-react";

interface RequestResult {
  statusCode: number;
  headers: Record<string, string>;
  isReplayed: boolean;
  body: unknown;
  timestamp: string;
}

export default function PlaygroundPage() {
  return (
    <AuthGate>
      <PlaygroundContent />
    </AuthGate>
  );
}

function PlaygroundContent() {
  const [prompt, setPrompt] = useState("Summarize the Q3 financial earnings report.");
  const [inputTokens, setInputTokens] = useState<number>(300);
  const [cachedTokens, setCachedTokens] = useState<number>(50);
  const [outputTokens, setOutputTokens] = useState<number>(150);
  const [reasoningTokens, setReasoningTokens] = useState<number>(75);

  const generateUuid = () =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  const [idempotencyKey, setIdempotencyKey] = useState<string>("");
  const [reuseKey, setReuseKey] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [results, setResults] = useState<RequestResult[]>([]);

  useEffect(() => {
    setIdempotencyKey(generateUuid());
  }, []);

  const handleSend = async (customKey?: string) => {
    const keyToUse = customKey || idempotencyKey;
    setLoading(true);

    const payload: GenerateRequestPayload = {
      prompt,
      simulated_usage: {
        input_tokens: Number(inputTokens),
        cached_input_tokens: Number(cachedTokens),
        output_tokens: Number(outputTokens),
        reasoning_tokens: Number(reasoningTokens),
      },
    };

    const res = await apiFetch("/generate", {
      method: "POST",
      body: JSON.stringify(payload),
      idempotencyKey: keyToUse,
    });

    const isReplayed =
      res.headers.get("Idempotent-Replayed") === "true" ||
      res.headers.get("idempotent-replayed") === "true";

    const headerMap: Record<string, string> = {};
    res.headers.forEach((val, key) => {
      headerMap[key] = val;
    });

    const result: RequestResult = {
      statusCode: res.status,
      headers: headerMap,
      isReplayed,
      body: res.data || { error: res.error },
      timestamp: new Date().toLocaleTimeString(),
    };

    setResults((prev) => [result, ...prev]);
    setLoading(false);

    if (!reuseKey) {
      setIdempotencyKey(generateUuid());
    }
  };

  const handleSendTwice = async () => {
    const fixedKey = idempotencyKey;
    setLoading(true);

    // Call 1
    const payload: GenerateRequestPayload = {
      prompt,
      simulated_usage: {
        input_tokens: Number(inputTokens),
        cached_input_tokens: Number(cachedTokens),
        output_tokens: Number(outputTokens),
        reasoning_tokens: Number(reasoningTokens),
      },
    };

    const res1 = await apiFetch("/generate", {
      method: "POST",
      body: JSON.stringify(payload),
      idempotencyKey: fixedKey,
    });

    const isReplayed1 =
      res1.headers.get("Idempotent-Replayed") === "true" ||
      res1.headers.get("idempotent-replayed") === "true";

    const hMap1: Record<string, string> = {};
    res1.headers.forEach((val, k) => {
      hMap1[k] = val;
    });

    const result1: RequestResult = {
      statusCode: res1.status,
      headers: hMap1,
      isReplayed: isReplayed1,
      body: res1.data || { error: res1.error },
      timestamp: new Date().toLocaleTimeString(),
    };

    // Immediate Call 2 with identical key and payload
    const res2 = await apiFetch("/generate", {
      method: "POST",
      body: JSON.stringify(payload),
      idempotencyKey: fixedKey,
    });

    const isReplayed2 =
      res2.headers.get("Idempotent-Replayed") === "true" ||
      res2.headers.get("idempotent-replayed") === "true";

    const hMap2: Record<string, string> = {};
    res2.headers.forEach((val, k) => {
      hMap2[k] = val;
    });

    const result2: RequestResult = {
      statusCode: res2.status,
      headers: hMap2,
      isReplayed: isReplayed2,
      body: res2.data || { error: res2.error },
      timestamp: new Date().toLocaleTimeString(),
    };

    setResults((prev) => [result2, result1, ...prev]);
    setLoading(false);

    if (!reuseKey) {
      setIdempotencyKey(generateUuid());
    }
  };

  const getStatusBadge = (code: number, isReplayed: boolean) => {
    if (code === 200) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-300 font-mono text-xs font-bold border border-green-200 dark:border-green-800">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>200 OK</span>
        </span>
      );
    }
    if (code === 402) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 font-mono text-xs font-bold border border-red-200 dark:border-red-800">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>402 Quota Exceeded</span>
        </span>
      );
    }
    if (code === 429) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-mono text-xs font-bold border border-amber-200 dark:border-amber-800">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>429 Rate Limited</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono text-xs font-bold border border-zinc-200 dark:border-zinc-700">
        <XCircle className="w-3.5 h-3.5" />
        <span>{code}</span>
      </span>
    );
  };

  return (
    <AuthGate>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--coffee)]">API Playground</h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Simulate AI inference calls, test atomic metering locks, verify idempotency caching, and observe quota ceilings.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Controls Form (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="p-6 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xs space-y-5">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                  Prompt
                </label>
                <textarea
                  rows={3}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-base)] text-xs text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--coral)] transition-all resize-none"
                />
              </div>

              {/* Simulated Token Fields */}
              <div>
                <span className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                  Simulated Token Components
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-[var(--text-muted)] block mb-1">Input</label>
                    <input
                      type="number"
                      min={0}
                      value={inputTokens}
                      onChange={(e) => setInputTokens(Number(e.target.value))}
                      className="w-full px-3 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-[var(--text-muted)] block mb-1">Cached Input</label>
                    <input
                      type="number"
                      min={0}
                      value={cachedTokens}
                      onChange={(e) => setCachedTokens(Number(e.target.value))}
                      className="w-full px-3 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-[var(--text-muted)] block mb-1">Output</label>
                    <input
                      type="number"
                      min={0}
                      value={outputTokens}
                      onChange={(e) => setOutputTokens(Number(e.target.value))}
                      className="w-full px-3 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-[var(--text-muted)] block mb-1">Reasoning</label>
                    <input
                      type="number"
                      min={0}
                      value={reasoningTokens}
                      onChange={(e) => setReasoningTokens(Number(e.target.value))}
                      className="w-full px-3 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] text-xs font-mono"
                    />
                  </div>
                </div>
                <div className="mt-2 text-right text-[11px] font-mono text-[var(--text-muted)]">
                  Total: {Number(inputTokens) + Number(cachedTokens) + Number(outputTokens) + Number(reasoningTokens)} tokens
                </div>
              </div>

              {/* Idempotency Key */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    Idempotency-Key
                  </label>
                  <button
                    type="button"
                    onClick={() => setIdempotencyKey(generateUuid())}
                    className="text-[11px] text-[var(--coral)] hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" /> New Key
                  </button>
                </div>
                <input
                  type="text"
                  value={idempotencyKey}
                  onChange={(e) => setIdempotencyKey(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-base)] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[var(--coral)]"
                />

                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="reuse-key"
                    checked={reuseKey}
                    onChange={(e) => setReuseKey(e.target.checked)}
                    className="rounded border-[var(--border-color)] text-[var(--coral)] focus:ring-[var(--coral)]"
                  />
                  <label htmlFor="reuse-key" className="text-xs text-[var(--text-muted)] select-none">
                    Reuse same key on subsequent requests
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleSend()}
                  className="w-full py-2.5 px-4 rounded-xl bg-[var(--coral)] text-white text-xs font-semibold hover:bg-[var(--coral)] disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send POST /generate</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={handleSendTwice}
                  className="w-full py-2 px-4 rounded-xl border border-[var(--coral)] bg-[var(--coral-light)] text-[var(--coral)] text-xs font-semibold hover:bg-[var(--coral)] hover:text-white disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  <Repeat className="w-3.5 h-3.5" />
                  <span>Send Twice (Verify Idempotency)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Response Inspector (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Response Logs ({results.length})
              </span>
              {results.length > 0 && (
                <button
                  onClick={() => setResults([])}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--coral)]"
                >
                  Clear logs
                </button>
              )}
            </div>

            {results.length === 0 ? (
              <div className="p-12 text-center rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-muted)]">
                <Terminal className="w-8 h-8 mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">No requests fired yet</p>
                <p className="text-xs mt-1">
                  Click <strong>&quot;Send POST /generate&quot;</strong> or <strong>&quot;Send Twice&quot;</strong> to test live quota locks and replay behavior.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {results.map((res, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xs space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-color)] pb-3">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(res.statusCode, res.isReplayed)}
                        {res.isReplayed && (
                          <span className="px-2 py-0.5 rounded-md bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 font-mono text-[11px] font-bold border border-sky-200 dark:border-sky-800">
                            Idempotent-Replayed: true
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-[var(--text-muted)]">
                        {res.timestamp}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] font-semibold text-[var(--text-muted)] block mb-1">
                        Response Body
                      </span>
                      <pre className="p-3 rounded-xl bg-[var(--bg-base)] border border-[var(--border-color)] text-xs font-mono overflow-x-auto max-h-56 leading-relaxed">
                        {JSON.stringify(res.body, null, 2)}
                      </pre>
                    </div>

                    <div className="text-[10px] text-[var(--text-muted)] font-mono flex items-center gap-2">
                      <span>Server: Fastify / Uvicorn</span>
                      <span>•</span>
                      <span>
                        Key: {res.headers["idempotency-key"] || "replayed-cache"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* FlyRank Capstone: Background Reconciliation & Alerting UI Panel */}
        <div className="pt-2">
          <ReconciliationCard />
        </div>
      </div>
    </AuthGate>
  );
}
