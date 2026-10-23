"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { setStoredApiKey, getStoredApiKey, DEMO_API_KEY, apiFetch } from "@/lib/api";
import { TenantMe } from "@/lib/types";
import { KeyRound, Sparkles, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";

export default function ConnectPage() {
  const router = useRouter();
  const [keyInput, setKeyInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifiedTenant, setVerifiedTenant] = useState<TenantMe | null>(null);

  useEffect(() => {
    const existing = getStoredApiKey();
    if (existing) {
      setKeyInput(existing);
    }
  }, []);

  const handleConnect = async (apiKeyToTest?: string) => {
    const key = (apiKeyToTest || keyInput).trim();
    if (!key) {
      setError("Please enter an API key.");
      return;
    }

    setLoading(true);
    setError(null);
    setVerifiedTenant(null);

    // Temporarily save to test
    setStoredApiKey(key);

    const res = await apiFetch<TenantMe>("/me");
    setLoading(false);

    if (res.error || !res.data) {
      setError(res.error || "Failed to authenticate with this API key.");
      return;
    }

    setVerifiedTenant(res.data);
    setTimeout(() => {
      router.push("/dashboard");
    }, 600);
  };

  const handleUseDemoKey = () => {
    if (!DEMO_API_KEY) {
      setError("No public demo key configured in NEXT_PUBLIC_DEMO_API_KEY.");
      return;
    }
    setKeyInput(DEMO_API_KEY);
    handleConnect(DEMO_API_KEY);
  };

  return (
    <div className="max-w-lg mx-auto py-10">
      <div className="p-8 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm">
        <div className="w-12 h-12 rounded-2xl bg-[var(--coral-light)] text-[var(--burgundy)] flex items-center justify-center mb-5">
          <KeyRound className="w-6 h-6" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-[var(--coffee)]">Connect Tenant</h1>
        <p className="mt-1.5 text-sm text-[var(--text-muted)]">
          Paste your tenant API key to review metering and test quota thresholds. The key stays exclusively in your browser&apos;s sessionStorage.
        </p>

        {error && (
          <div className="mt-5 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-start gap-2.5 text-xs text-red-700 dark:text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {verifiedTenant && (
          <div className="mt-5 p-3.5 rounded-xl bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900/50 flex items-center gap-2.5 text-xs text-green-700 dark:text-green-400">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Authenticated as <strong>{verifiedTenant.name}</strong> ({verifiedTenant.plan} plan). Redirecting...</span>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleConnect();
          }}
          className="mt-6 space-y-4"
        >
          <div>
            <label htmlFor="api-key" className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
              API Key (X-API-Key)
            </label>
            <input
              id="api-key"
              type="text"
              placeholder="e.g. 07dcfde3523d..."
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-base)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--burgundy)] transition-all"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-[var(--burgundy)] text-white font-medium text-sm hover:bg-[var(--burgundy-hover)] disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Connect & Enter</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[var(--border-color)]" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-[var(--bg-card)] px-3 text-[var(--text-muted)]">OR</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleUseDemoKey}
          disabled={loading}
          className="w-full py-2.5 px-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] hover:border-[var(--coral)] hover:text-[var(--burgundy)] text-xs font-semibold text-[var(--coffee)] transition-all flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4 text-[var(--coral)]" />
          <span>Use Demo Key (Prefilled)</span>
        </button>

        <p className="mt-4 text-[11px] text-center text-[var(--text-muted)]">
          Demo key connects to pre-seeded evaluation tenant Tenant A.
        </p>
      </div>
    </div>
  );
}
