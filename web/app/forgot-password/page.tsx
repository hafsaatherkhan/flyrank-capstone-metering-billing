"use client";

import { useState } from "react";
import Link from "next/link";
import HisaabLedgerLogo from "@/components/HisaabLedgerLogo";
import { Mail, ArrowRight, AlertCircle, CheckCircle2, KeyRound } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenReceived, setTokenReceived] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000";
      const res = await fetch(`${apiUrl}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Request failed");
      }

      if (data.reset_token) {
        setTokenReceived(data.reset_token);
      } else {
        setTokenReceived("DISPATCHED");
      }
    } catch (err: any) {
      setError(err.message || "Failed to process forgot password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12 px-4">
      <div className="p-8 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm">
        <div className="flex flex-col items-center text-center mb-6">
          <HisaabLedgerLogo size={46} showText={false} />
          <h1 className="text-2xl font-bold tracking-tight text-[var(--coffee)] mt-3">
            Reset Password
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Enter your email to receive a secure password reset token
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-start gap-2.5 text-xs text-red-700 dark:text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {tokenReceived ? (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Reset Link & Token Generated!</span>
            </div>
            {tokenReceived !== "DISPATCHED" && (
              <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-900/40 font-mono text-[11px] text-[var(--coffee)] break-all select-all">
                {tokenReceived}
              </div>
            )}
            <p className="text-xs text-emerald-700 dark:text-emerald-400">
              Use this reset token to change your account password.
            </p>
            <Link
              href={`/change-password?token=${tokenReceived !== "DISPATCHED" ? tokenReceived : ""}`}
              className="inline-flex items-center justify-center w-full py-2 px-3 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors"
            >
              Proceed to Change Password
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
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
                  placeholder="registered@company.com"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] text-xs text-[var(--coffee)] focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <Mail className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-semibold text-xs transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Send Reset Link</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-[var(--text-muted)]">
          Remember your password?{" "}
          <Link href="/login" className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
            Back to Login
          </Link>
        </p>
      </div>
    </div>
  );
}
