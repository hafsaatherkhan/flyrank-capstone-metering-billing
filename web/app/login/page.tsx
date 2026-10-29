"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { setSessionTokens, setStoredApiKey } from "@/lib/api";
import HisaabLedgerLogo from "@/components/HisaabLedgerLogo";
import { Mail, Lock, ArrowRight, AlertCircle, Clock } from "lucide-react";

/** Reads ?reason=session_expired from URL — must be inside <Suspense> */
function SessionExpiredBanner({ onExpired }: { onExpired: () => void }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get("reason") === "session_expired") {
      onExpired();
    }
  }, [searchParams, onExpired]);
  return null;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000";
      const res = await fetch(`${apiUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Authentication failed");
      }

      setSessionTokens(data.access_token, data.refresh_token, data.user);
      if (data.api_key) {
        setStoredApiKey(data.api_key);
      }

      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to log in");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    setError(null);
    try {
      const simulatedGoogleUser = {
        google_id: "google_verified_user",
        name: "Google Authenticated User",
        email: email.trim() || "demo.ledger.user@gmail.com",
      };

      const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000";
      const res = await fetch(`${apiUrl}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(simulatedGoogleUser),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Google auth failed");
      }

      setSessionTokens(data.access_token, data.refresh_token, data.user);
      if (data.api_key) {
        setStoredApiKey(data.api_key);
      }

      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Google sign-in error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12 px-4">
      {/* useSearchParams must be inside Suspense to avoid prerender blocking */}
      <Suspense fallback={null}>
        <SessionExpiredBanner onExpired={() => setSessionExpired(true)} />
      </Suspense>

      <div className="p-8 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm">
        <div className="flex flex-col items-center text-center mb-6">
          <HisaabLedgerLogo size={46} showText={false} />
          <h1 className="text-2xl font-bold tracking-tight text-[var(--coffee)] mt-3">
            Welcome Back
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Access your HisaabLedger precision analytics & metering
          </p>
        </div>

        {sessionExpired && (
          <div className="mb-4 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 flex items-start gap-2.5 text-xs text-amber-700 dark:text-amber-400">
            <Clock className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Your session has expired. Please log in again to continue.</span>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-start gap-2.5 text-xs text-red-700 dark:text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Third Party Authenticator: ONLY Google */}
        <button
          type="button"
          onClick={handleGoogleAuth}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] hover:bg-[var(--border-color)] text-xs font-semibold text-[var(--coffee)] transition-colors mb-5 disabled:opacity-60"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.05h3.9c2.28-2.1 3.64-5.2 3.64-9.14z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.9-3.05c-1.08.72-2.45 1.16-4.03 1.16-3.1 0-5.73-2.1-6.68-4.94H1.28v3.15C3.3 21.36 7.37 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.32 14.26a7.16 7.16 0 0 1 0-4.52V6.59H1.28a11.97 11.97 0 0 0 0 10.82l4.04-3.15z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.37 0 3.3 2.64 1.28 6.59l4.04 3.15c.95-2.84 3.58-4.99 6.68-4.99z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        <div className="relative my-4 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[var(--border-color)]" />
          </div>
          <span className="relative bg-[var(--bg-card)] px-3 text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">
            Or login with credentials
          </span>
        </div>

        <form onSubmit={handleLogin} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] text-xs text-[var(--coffee)] focus:outline-none focus:ring-2 focus:ring-[var(--coral)]/20"
              />
              <Mail className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-[var(--coral)] hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] text-xs text-[var(--coffee)] focus:outline-none focus:ring-2 focus:ring-[var(--coral)]/20"
              />
              <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[var(--coral)] to-[var(--coral)] hover:opacity-95 text-white font-semibold text-xs transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-[var(--border-color)] flex flex-col items-center gap-2 text-xs text-[var(--text-muted)]">
          <p>
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-semibold text-[var(--coral)] hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
