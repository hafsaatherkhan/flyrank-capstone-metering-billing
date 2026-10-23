"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredApiKey } from "@/lib/api";
import { KeyRound } from "lucide-react";
import Link from "next/link";

interface Props {
  children: React.ReactNode;
}

export default function AuthGate({ children }: Props) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    const key = getStoredApiKey();
    if (!key) {
      setHasKey(false);
      setChecked(true);
    } else {
      setHasKey(true);
      setChecked(true);
    }
  }, []);

  if (!checked) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--burgundy)] border-t-transparent" />
      </div>
    );
  }

  if (!hasKey) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm text-center">
        <div className="w-12 h-12 rounded-full bg-[var(--coral-light)] text-[var(--burgundy)] flex items-center justify-center mx-auto mb-4">
          <KeyRound className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold tracking-tight mb-2">Authentication Required</h2>
        <p className="text-sm text-[var(--text-muted)] mb-6">
          Connect your API key to access live metering metrics, test endpoints in the playground, and view usage logs.
        </p>
        <Link
          href="/connect"
          className="inline-flex items-center justify-center w-full py-2.5 px-4 rounded-xl bg-[var(--burgundy)] text-white font-medium text-sm hover:bg-[var(--burgundy-hover)] transition-all shadow-sm"
        >
          Go to Connect Screen
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
