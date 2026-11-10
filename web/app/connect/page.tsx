"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getStoredApiKey, setStoredApiKey, getStoredUser, apiFetch, StoredUser, API_URL } from "@/lib/api";
import { TenantMe } from "@/lib/types";
import {
  KeyRound,
  Building2,
  Copy,
  Check,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  Code2,
  Eye,
  EyeOff,
} from "lucide-react";

export default function ConnectPage() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [tenant, setTenant] = useState<TenantMe | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedTenantId, setCopiedTenantId] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rotating, setRotating] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [activeSnippet, setActiveSnippet] = useState<"curl" | "node" | "python">("curl");

  useEffect(() => {
    const localUser = getStoredUser();
    const localKey = getStoredApiKey();
    setUser(localUser);
    setApiKey(localKey);

    Promise.all([
      apiFetch<StoredUser>("/auth/me"),
      apiFetch<TenantMe>("/me"),
    ]).then(([meRes, tenantRes]) => {
      if (meRes.data) setUser(meRes.data);
      if (tenantRes.data) setTenant(tenantRes.data);
      setLoading(false);
    });
  }, []);

  const handleCopy = (text: string, type: "key" | "tenant") => {
    navigator.clipboard.writeText(text);
    if (type === "key") {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } else {
      setCopiedTenantId(true);
      setTimeout(() => setCopiedTenantId(false), 2000);
    }
  };

  const handleRotateKey = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to rotate your API key? Any existing backend or scripts using your old key will immediately stop working."
    );
    if (!confirmed) return;

    setRotating(true);
    setMessage(null);

    const res = await apiFetch<{ message: string; api_key: string; tenant_id: string }>(
      "/auth/rotate-api-key",
      { method: "POST" }
    );

    setRotating(false);
    if (res.data?.api_key) {
      setApiKey(res.data.api_key);
      setStoredApiKey(res.data.api_key);
      setShowKey(true);
      setMessage({
        type: "success",
        text: "New API key generated successfully! Old key has been revoked.",
      });
    } else {
      setMessage({
        type: "error",
        text: res.error || "Failed to rotate API key.",
      });
    }
  };

  const tenantId = user?.tenant_id || tenant?.id || "your-tenant-uuid";
  const actualOrMaskedKey = showKey && apiKey ? apiKey : apiKey ? `${apiKey.slice(0, 10)}••••••••••••••••••••••••` : "fk_live_••••••••••••••••••••••••••••";

  const targetUrl = API_URL ? `${API_URL}/generate` : "http://localhost:8000/generate";

  const codeSnippets = {
    curl: `curl -X POST "${targetUrl}" \\
  -H "X-API-Key: ${apiKey || "YOUR_API_KEY"}" \\
  -H "Idempotency-Key: req-sample-12345" \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "Summarize the Q3 financial earnings report.",
    "simulated_usage": {
      "input_tokens": 300,
      "cached_input_tokens": 50,
      "output_tokens": 150,
      "reasoning_tokens": 75
    }
  }'`,
    node: `import fetch from "node-fetch";

const response = await fetch("${targetUrl}", {
  method: "POST",
  headers: {
    "X-API-Key": "${apiKey || "YOUR_API_KEY"}",
    "Idempotency-Key": "req-sample-12345",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    prompt: "Summarize the Q3 financial earnings report.",
    simulated_usage: {
      input_tokens: 300,
      cached_input_tokens: 50,
      output_tokens: 150,
      reasoning_tokens: 75,
    },
  }),
});

const data = await response.json();
console.log(data);`,
    python: `import requests

url = "${targetUrl}"
headers = {
    "X-API-Key": "${apiKey || "YOUR_API_KEY"}",
    "Idempotency-Key": "req-sample-12345",
    "Content-Type": "application/json",
}
payload = {
    "prompt": "Summarize the Q3 financial earnings report.",
    "simulated_usage": {
        "input_tokens": 300,
        "cached_input_tokens": 50,
        "output_tokens": 150,
        "reasoning_tokens": 75,
    },
}

response = requests.post(url, json=payload, headers=headers)
print(response.json())`,
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--coral-light)] text-[var(--coral)] text-xs font-semibold mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Developer Integration Hub</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--coffee)]">
            Connect &amp; API Credentials
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Securely link your backend, services, or scripts to your HisaabLedger tenant.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="self-start sm:self-auto px-4 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] hover:bg-[var(--bg-surface)] text-xs font-semibold text-[var(--coffee)] transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded-2xl flex items-start gap-3 text-xs ${
            message.type === "success"
              ? "bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900/50 text-green-800 dark:text-green-300"
              : "bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-800 dark:text-red-300"
          }`}
        >
          {message.type === "success" ? (
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-green-600" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {/* Credentials Card */}
        <div className="p-6 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm">
          <h2 className="text-sm font-bold text-[var(--coffee)] mb-4 flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-[var(--coral)]" />
            Your Workspace Credentials
          </h2>

          <div className="space-y-4">
            {/* Tenant ID */}
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] block mb-1.5">
                Tenant Identifier (Public ID)
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] font-mono text-xs text-[var(--coffee)]">
                  <Building2 className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                  <span className="truncate">{tenantId}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(tenantId, "tenant")}
                  className="px-3.5 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] hover:bg-[var(--bg-card)] text-xs font-semibold text-[var(--coffee)] flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Copy Tenant ID"
                >
                  {copiedTenantId ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-[var(--text-muted)]" />}
                  <span>{copiedTenantId ? "Copied" : "Copy"}</span>
                </button>
              </div>
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                Assigned automatically to your account (<strong>{tenant?.name || user?.name || "Personal Workspace"}</strong>).
              </p>
            </div>

            {/* API Key */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Secret API Key (X-API-Key)
                </label>
                <div className="flex items-center gap-2">
                  {apiKey && (
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="text-[11px] text-[var(--text-muted)] hover:text-[var(--coffee)] flex items-center gap-1 cursor-pointer"
                    >
                      {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{showKey ? "Hide" : "Show"}</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] font-mono text-xs text-[var(--coffee)]">
                  <KeyRound className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="truncate">{actualOrMaskedKey}</span>
                </div>
                <button
                  type="button"
                  disabled={!apiKey}
                  onClick={() => apiKey && handleCopy(apiKey, "key")}
                  className="px-3.5 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] hover:bg-[var(--bg-card)] text-xs font-semibold text-[var(--coffee)] flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
                  title="Copy API Key"
                >
                  {copiedKey ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-[var(--text-muted)]" />}
                  <span>{copiedKey ? "Copied" : "Copy"}</span>
                </button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-2">
                <p className="text-[11px] text-[var(--text-muted)]">
                  Keep this confidential. Never expose your secret key in client-side code.
                </p>
                <button
                  type="button"
                  onClick={handleRotateKey}
                  disabled={rotating}
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--coral)] hover:underline cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${rotating ? "animate-spin" : ""}`} />
                  <span>{rotating ? "Rotating Key..." : "Rotate / Regenerate API Key"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Integration Code Snippets */}
        <div className="p-6 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h2 className="text-sm font-bold text-[var(--coffee)] flex items-center gap-2">
              <Code2 className="w-4 h-4 text-[var(--coral)]" />
              Quick Integration Snippets
            </h2>

            {/* Language Tabs */}
            <div className="flex p-1 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs font-semibold self-start sm:self-auto">
              <button
                onClick={() => setActiveSnippet("curl")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  activeSnippet === "curl"
                    ? "bg-[var(--bg-card)] text-[var(--coffee)] shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--coffee)]"
                }`}
              >
                cURL
              </button>
              <button
                onClick={() => setActiveSnippet("node")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  activeSnippet === "node"
                    ? "bg-[var(--bg-card)] text-[var(--coffee)] shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--coffee)]"
                }`}
              >
                Node.js
              </button>
              <button
                onClick={() => setActiveSnippet("python")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  activeSnippet === "python"
                    ? "bg-[var(--bg-card)] text-[var(--coffee)] shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--coffee)]"
                }`}
              >
                Python
              </button>
            </div>
          </div>

          <div className="relative rounded-2xl bg-zinc-950 p-4 border border-zinc-800 font-mono text-xs text-zinc-100 overflow-x-auto">
            <button
              onClick={() => {
                navigator.clipboard.writeText(codeSnippets[activeSnippet]);
                setMessage({ type: "success", text: "Code snippet copied to clipboard!" });
                setTimeout(() => setMessage(null), 2500);
              }}
              className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Code</span>
            </button>
            <pre className="pr-20 whitespace-pre">{codeSnippets[activeSnippet]}</pre>
          </div>

          <p className="mt-3 text-[11px] text-[var(--text-muted)]">
            Send events or requests with the <code className="font-mono bg-[var(--bg-surface)] px-1.5 py-0.5 rounded text-[var(--coffee)]">X-API-Key</code> header to meter usage under your tenant ledger.
          </p>
        </div>
      </div>
    </div>
  );
}
