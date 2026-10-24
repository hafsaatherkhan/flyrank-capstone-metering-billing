"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredApiKey, getAccessToken } from "@/lib/api";
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
    const key = getStoredApiKey();
    const token = getAccessToken();
    if (!key && !token) {
      setAuthenticated(false);
      setChecked(true);
    } else {
      setAuthenticated(true);
      setChecked(true);
    }
  }, []);

  if (!checked) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
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
            className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition-all shadow-sm"
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
