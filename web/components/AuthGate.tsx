"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredApiKey, getAccessToken, clearSession, apiFetch } from "@/lib/api";
import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import HisaabLedgerLogo from "./HisaabLedgerLogo";

interface Props {
  children: React.ReactNode;
}

export default function AuthGate({ children }: Props) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function verifyAuth() {
      const key = getStoredApiKey();
      const token = getAccessToken();

      // Case 1: No credentials at all
      if (!key && !token) {
        if (isMounted) {
          setAuthenticated(false);
          setChecked(true);
        }
        return;
      }

      // Case 2: Validate JWT token with backend if present
      if (token) {
        try {
          const res = await apiFetch<{ id: string }>("/auth/me");
          if (res.status === 200 && res.data) {
            if (isMounted) {
              setAuthenticated(true);
              setChecked(true);
            }
            return;
          }
        } catch {
          // Fall through to API key check or reject
        }
      }

      // Case 3: Validate API Key with backend if present
      if (key) {
        try {
          const res = await apiFetch<{ id: string }>("/me");
          if (res.status === 200 && res.data) {
            if (isMounted) {
              setAuthenticated(true);
              setChecked(true);
            }
            return;
          }
        } catch {
          // Fall through
        }
      }

      // Invalid/expired credentials
      clearSession();
      if (isMounted) {
        setAuthenticated(false);
        setChecked(true);
      }
    }

    verifyAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  if (!checked) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--coral)] border-t-transparent" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm text-center">
        <div className="flex justify-center mb-5">
          <HisaabLedgerLogo size={48} showText={false} />
        </div>
        <h2 className="text-xl font-bold tracking-tight mb-2 text-[var(--coffee)]">Authentication Required</h2>
        <p className="text-sm text-[var(--text-muted)] mb-6">
          Please login or create your HisaabLedger account to inspect real-time metering, charts, and API ledgers.
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href="/login"
            className="w-full py-2.5 px-4 rounded-xl bg-[var(--coral)] text-white font-semibold text-sm hover:opacity-90 transition-all shadow-sm"
          >
            Login to HisaabLedger
          </Link>
          <Link
            href="/signup"
            className="w-full py-2.5 px-4 rounded-xl border border-[var(--border-color)] text-[var(--coffee)] font-semibold text-sm hover:bg-[var(--bg-surface)] transition-all"
          >
            Create New Account
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
