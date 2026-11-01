"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setSessionTokens, setStoredApiKey } from "@/lib/api";
import HisaabLedgerLogo from "@/components/HisaabLedgerLogo";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { Mail, Lock, User as UserIcon, ArrowRight, AlertCircle, CheckCircle2, X } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (password !== confirmPassword) {
      setError("Password and confirm password do not match.");
      return;
    }

    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000";
      const res = await fetch(`${apiUrl}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          confirm_password: confirmPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Signup failed");
      }

      // Store tokens and API key
      setSessionTokens(data.access_token, data.refresh_token, data.user);
      if (data.api_key) {
        setStoredApiKey(data.api_key);
      }

      setSuccess(`Welcome to HisaabLedger, ${data.user.name}! Welcome email dispatched.`);
      setTimeout(() => {
        router.push("/dashboard");
      }, 1000);
    } catch (err: any) {
      setError(err.message || "Something went wrong during signup");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleToken = async (idToken: string) => {
    setLoading(true);
    setError(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000";
      const res = await fetch(`${apiUrl}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_token: idToken }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Google auth failed");
      }

      setSessionTokens(data.access_token, data.refresh_token, data.user);
      if (data.api_key) {
        setStoredApiKey(data.api_key);
      }

      setSuccess(`Signed in with Google as ${data.user.name}!`);
      setTimeout(() => {
        router.push("/dashboard");
      }, 900);
    } catch (err: any) {
      setError(err.message || "Google sign-in error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      {/* Background click handler */}
      <div
        className="fixed inset-0 -z-10"
        onClick={() => router.push("/")}
        aria-hidden="true"
      />

      {/* Popup Window Modal */}
      <div className="relative w-full max-w-md my-auto rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xl p-7 sm:p-8 animate-in zoom-in-95 duration-200">
        {/* Top Window Accent Bar */}
        <div className="absolute top-0 left-8 right-8 h-1 rounded-b bg-gradient-to-r from-transparent via-[var(--coral)] to-transparent opacity-80" />

        {/* Close / Dismiss Button */}
        <button
          type="button"
          onClick={() => router.push("/")}
          aria-label="Close"
          className="absolute top-4 right-4 p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--coffee)] hover:bg-[var(--bg-surface)] transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center text-center mb-5 pt-1">
          <HisaabLedgerLogo size={46} showText={false} />
          <h1 className="text-2xl font-bold tracking-tight text-[var(--coffee)] mt-3">
            Create your Account
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Join HisaabLedger for real-time metering, token ledgers & analytics
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-start gap-2.5 text-xs text-red-700 dark:text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 flex items-start gap-2.5 text-xs text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        {/* Third Party Authenticator: ONLY Google */}
        <div className="mb-5">
          <GoogleSignInButton
            text="signup_with"
            disabled={loading}
            onSuccess={handleGoogleToken}
            onError={(err) => setError(err)}
          />
        </div>

        <div className="relative my-4 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[var(--border-color)]" />
          </div>
          <span className="relative bg-[var(--bg-card)] px-3 text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">
            Or register with email
          </span>
        </div>

        {/* Required Fields: Name, Email, Password, Confirm Password */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
              Your Name
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Bilal Ahmed"
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] text-xs text-[var(--coffee)] focus:outline-none focus:ring-2 focus:ring-[var(--coral)]/20"
              />
              <UserIcon className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

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
            <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] text-xs text-[var(--coffee)] focus:outline-none focus:ring-2 focus:ring-[var(--coral)]/20"
              />
              <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
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
                <span>Create HisaabLedger Account</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-[var(--text-muted)]">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-[var(--coral)] hover:underline">
            Login here
          </Link>
        </p>
      </div>
    </div>
  );
}
