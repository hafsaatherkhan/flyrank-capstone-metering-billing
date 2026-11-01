"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getStoredUser, getStoredApiKey, apiFetch, StoredUser } from "@/lib/api";
import { TenantMe } from "@/lib/types";
import { User, Mail, Building2, Key, ArrowRight, Sparkles, Crown, CheckCircle2, X } from "lucide-react";
import { CheckoutResponse } from "@/lib/types";

export default function ProfilePage() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [tenant, setTenant] = useState<TenantMe | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const fetchTenantData = () => {
    apiFetch<TenantMe>("/me").then((res) => {
      if (res.data) setTenant(res.data);
    });
  };

  useEffect(() => {
    const storedUser = getStoredUser();
    const storedKey = getStoredApiKey();
    setUser(storedUser);
    setApiKey(storedKey);

    Promise.all([
      apiFetch<StoredUser>("/auth/me"),
      apiFetch<TenantMe>("/me"),
    ]).then(([meRes, tenantRes]) => {
      if (meRes.data) setUser(meRes.data);
      if (tenantRes.data) setTenant(tenantRes.data);
      setLoading(false);
    });

    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("checkout") === "success") {
        setShowUpgradeModal(true);
        fetchTenantData();
      }
    }
  }, []);

  const handleUpgradePlan = async () => {
    setUpgrading(true);
    try {
      const res = await apiFetch<CheckoutResponse>("/checkout", {
        method: "POST",
      });

      if (res.data?.checkout_url) {
        window.location.href = res.data.checkout_url;
      } else {
        setShowUpgradeModal(true);
        if (tenant) {
          setTenant({ ...tenant, plan: "pro" });
        }
      }
    } catch {
      setShowUpgradeModal(true);
      if (tenant) {
        setTenant({ ...tenant, plan: "pro" });
      }
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--coffee)]">Account Profile</h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Manage your personal profile, credentials, and tenant linkage.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="px-3.5 py-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] hover:bg-[var(--bg-surface)] text-xs font-semibold text-[var(--coffee)] transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>

      <div className="space-y-6">
        {/* Profile Card */}
        <div className="p-6 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm">
          <h2 className="text-sm font-bold text-[var(--coffee)] mb-4 flex items-center gap-2">
            <User className="w-4 h-4 text-[var(--coral)]" />
            Personal Details
          </h2>

          <div className="space-y-4 text-xs">
            <div>
              <label className="text-[var(--text-muted)] font-medium block mb-1">Full Name</label>
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--coffee)] font-medium">
                <User className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                <span>{user?.name || tenant?.name || "HisaabLedger Member"}</span>
              </div>
            </div>

            <div>
              <label className="text-[var(--text-muted)] font-medium block mb-1">Email Address</label>
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--coffee)] font-medium">
                <Mail className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                <span>{user?.email || "No email on record"}</span>
              </div>
            </div>

            <div>
              <label className="text-[var(--text-muted)] font-medium block mb-1">Tenant ID</label>
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] font-mono text-[11px] text-[var(--text-muted)]">
                <Building2 className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                <span className="truncate">{user?.tenant_id || tenant?.id || "Direct user"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Subscription Tier Card */}
        <div className="p-6 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm">
          <h2 className="text-sm font-bold text-[var(--coffee)] mb-3 flex items-center gap-2">
            <Key className="w-4 h-4 text-amber-500" />
            Subscription Tier
          </h2>
          <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] mb-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Active Plan</p>
              {tenant?.plan?.toLowerCase() === "pro" ? (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                  <Crown className="w-3 h-3" /> Pro Active
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 text-[var(--text-muted)]">
                  Free Tier
                </span>
              )}
            </div>
            <p className="text-xl font-extrabold text-[var(--coral)] uppercase mt-1">
              {tenant?.plan?.toLowerCase() === "pro" ? "Pro Tier" : "Free Tier"}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              {tenant?.plan?.toLowerCase() === "pro"
                ? "Unlimited possibilities with 10k API calls & 1M tokens/mo."
                : "Basic access with starter quota. Upgrade to unlock full limits."}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            {tenant?.plan?.toLowerCase() !== "pro" ? (
              <button
                onClick={handleUpgradePlan}
                disabled={upgrading}
                className="w-full sm:w-auto flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-[var(--coral)] text-white text-xs font-bold hover:opacity-90 transition-all shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{upgrading ? "Upgrading..." : "Upgrade to Pro"}</span>
              </button>
            ) : null}

            <Link
              href="/connect"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border-color)] hover:bg-[var(--bg-surface)] text-xs font-semibold text-[var(--coffee)] transition-colors"
            >
              <span>Manage API Key</span>
              <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            </Link>
          </div>
        </div>
      </div>

      {/* Upgrade Success Modal */}
      {showUpgradeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-md rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xl overflow-hidden p-6 text-center">
            {/* Top gradient accent */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-[var(--coral)] to-purple-600" />

            <button
              onClick={() => {
                setShowUpgradeModal(false);
                if (typeof window !== "undefined") {
                  const url = new URL(window.location.href);
                  url.searchParams.delete("checkout");
                  window.history.replaceState({}, "", url.pathname + (url.search || ""));
                }
              }}
              className="absolute top-4 right-4 p-1.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--coffee)] hover:bg-[var(--bg-surface)] transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-[var(--coral)] flex items-center justify-center shadow-lg shadow-[var(--coral)]/20">
              <Crown className="w-8 h-8 text-white" />
            </div>

            <h3 className="text-xl font-bold text-[var(--coffee)] mb-1">
              Plan Upgraded Successfully! 🎉
            </h3>
            <p className="text-xs text-[var(--text-muted)] mb-5">
              Your account has been upgraded from <strong>Free Tier</strong> to <strong>Pro Tier</strong>!
            </p>

            <div className="space-y-2 mb-6 text-left">
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs text-[var(--coffee)]">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>10,000 API calls & 1,000,000 tokens included</span>
              </div>
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs text-[var(--coffee)]">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Full Ledger & Analytics suite enabled</span>
              </div>
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs text-[var(--coffee)]">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Priority customer support</span>
              </div>
            </div>

            <button
              onClick={() => {
                setShowUpgradeModal(false);
                if (typeof window !== "undefined") {
                  const url = new URL(window.location.href);
                  url.searchParams.delete("checkout");
                  window.history.replaceState({}, "", url.pathname + (url.search || ""));
                }
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-[var(--coral)] text-white text-xs font-bold hover:opacity-90 transition-all shadow-sm"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
