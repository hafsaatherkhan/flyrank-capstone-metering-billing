"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import {
  getStoredApiKey,
  getAccessToken,
  getStoredUser,
  clearSession,
  apiFetch,
  StoredUser,
} from "@/lib/api";
import { TenantMe } from "@/lib/types";
import HisaabLedgerLogo from "./HisaabLedgerLogo";
import {
  Gauge,
  Terminal,
  ListChecks,
  LogOut,
  LogIn,
  UserPlus,
  User as UserIcon,
  MousePointer,
  Sparkles,
  ChevronDown,
  CreditCard,
  ShieldCheck,
  Crown,
  CheckCircle2,
  X,
  ArrowRight,
  Menu,
  HelpCircle,
  Compass,
  FileText,
  Info,
  Lock,
} from "lucide-react";
import { CheckoutResponse } from "@/lib/types";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [tenant, setTenant] = useState<TenantMe | null>(null);
  const [cursorEnabled, setCursorEnabled] = useState<boolean>(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeSuccess, setUpgradeSuccess] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  const isLandingPage = pathname === "/";
  // On login, signup, forgot-password, and change-password, we display an immersive popup modal window on a themed backdrop
  const isAuthPage =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password" ||
    pathname === "/change-password";

  const fetchTenantMe = () => {
    apiFetch<TenantMe>("/me").then((res) => {
      if (res.data) {
        setTenant(res.data);
      }
    });
  };

  useEffect(() => {
    const key = getStoredApiKey();
    const token = getAccessToken();
    const currentUser = getStoredUser();

    setApiKey(key);
    setUser(currentUser);

    if (token) {
      apiFetch<StoredUser>("/auth/me").then((res) => {
        if (res.data) {
          setUser(res.data);
          fetchTenantMe();
        } else if (res.status === 401) {
          clearSession();
          setApiKey(null);
          setUser(null);
          setTenant(null);
        }
      });
    } else if (key) {
      fetchTenantMe();
    } else {
      setUser(null);
      setTenant(null);
    }

    // Cursor preference
    const savedCursor = localStorage.getItem("hl-cursor");
    if (savedCursor !== null) {
      setCursorEnabled(savedCursor !== "off");
    }

    const handleCursorSync = (e: any) => {
      if (e.detail?.enabled !== undefined) {
        setCursorEnabled(e.detail.enabled);
      }
    };
    window.addEventListener("hl-cursor-change" as any, handleCursorSync);
    return () => {
      window.removeEventListener("hl-cursor-change" as any, handleCursorSync);
    };
  }, [pathname]);

  // Check for successful upgrade via URL parameter
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("checkout") === "success") {
        setUpgradeSuccess(true);
        fetchTenantMe();
      }
    }
  }, [pathname]);

  // Close menus on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setDrawerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Close dropdown on route change
  useEffect(() => {
    setProfileOpen(false);
    setDrawerOpen(false);
  }, [pathname]);

  const toggleCursor = () => {
    const next = !cursorEnabled;
    setCursorEnabled(next);
    localStorage.setItem("hl-cursor", next ? "on" : "off");
    window.dispatchEvent(new CustomEvent("hl-cursor-change", { detail: { enabled: next } }));
  };

  const handleUpgradePlan = async () => {
    setUpgrading(true);
    setProfileOpen(false);
    setDrawerOpen(false);
    try {
      const res = await apiFetch<CheckoutResponse>("/checkout", {
        method: "POST",
      });

      if (res.data?.checkout_url) {
        window.location.href = res.data.checkout_url;
      } else {
        setUpgradeSuccess(true);
        if (tenant) {
          setTenant({ ...tenant, plan: "pro" });
        }
      }
    } catch {
      setUpgradeSuccess(true);
      if (tenant) {
        setTenant({ ...tenant, plan: "pro" });
      }
    } finally {
      setUpgrading(false);
    }
  };

  const handleLogout = async () => {
    setProfileOpen(false);
    setDrawerOpen(false);
    const refreshToken =
      typeof window !== "undefined"
        ? document.cookie.match(/hisaabledger_refresh_token=([^;]*)/)?.[1]
        : null;
    if (refreshToken) {
      try {
        await apiFetch("/auth/logout", {
          method: "POST",
          body: JSON.stringify({ refresh_token: decodeURIComponent(refreshToken) }),
        });
      } catch {
        // Proceed even if server call fails
      }
    }
    clearSession();
    setApiKey(null);
    setUser(null);
    setTenant(null);
    router.push("/login");
  };

  // Section anchors on landing page
  const landingNavSections = [
    { href: "/#how", label: "How It Works" },
    { href: "/#features", label: "Features" },
    { href: "/#pricing", label: "Pricing" },
    { href: "/#about", label: "About" },
  ];

  const appNavLinks = [
    { href: "/dashboard", label: "Dashboard", icon: Gauge },
    { href: "/playground", label: "Playground", icon: Terminal },
    { href: "/events", label: "Events & Ledger", icon: ListChecks },
  ];

  const isLoggedIn = !!apiKey || !!user;

  // Hide entire navbar on login and signup/auth pages (after all hooks have been evaluated)
  if (isAuthPage) {
    return null;
  }

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-[var(--bg-base)]/85 border-b border-[var(--border-color)] transition-colors">
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand Logo (always visible on left-most) */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Link href="/" className="flex items-center gap-1.5 sm:gap-2 group">
            <HisaabLedgerLogo size={32} />
          </Link>
        </div>

        {/* Center: On landing page, show in-page section links. On app pages (dashboard/playground/etc), NO center navigation as requested! */}
        {isLandingPage && (
          <nav className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-1.5 text-xs">
            {landingNavSections.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="px-3.5 py-1.5 rounded-full font-medium text-[var(--text-muted)] hover:text-[var(--coffee)] hover:bg-[var(--bg-surface)] transition-all"
              >
                {item.label}
              </a>
            ))}
          </nav>
        )}

        {/* Right side:
            - On landing page: Cursor Toggle + Get Started (or Dashboard if logged in)
            - On app/dashboard pages: Only Hamburger Menu (User info, account links, docs, platform nav, logout are inside) */}
        {isLandingPage ? (
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Custom Cursor Toggle Button - hidden on small mobile to prevent squishing */}
            <button
              type="button"
              onClick={toggleCursor}
              title={
                cursorEnabled
                  ? "Interactive cursor ON (Click to turn OFF)"
                  : "Interactive cursor OFF (Click to turn ON)"
              }
              className={`hidden sm:flex items-center justify-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl text-xs font-semibold transition-all shadow-sm active:scale-95 cursor-pointer ${
                cursorEnabled
                  ? "bg-[var(--coral)] text-white border border-[var(--coral)] hover:opacity-90 shadow-[var(--coral)]/20"
                  : "bg-transparent text-[var(--coral)] border-2 border-[var(--coral)] hover:bg-[var(--coral-light)]"
              }`}
              aria-label={`Interactive Cursor ${cursorEnabled ? "ON" : "OFF"}`}
            >
              <MousePointer
                className={`w-4 h-4 ${cursorEnabled ? "text-white fill-white" : "text-[var(--coral)]"}`}
              />
              <span className="hidden sm:inline font-mono text-[11px] font-bold">
                {cursorEnabled ? "ON" : "OFF"}
              </span>
            </button>

            {/* Get Started / Dashboard button */}
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="flex items-center gap-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-[var(--coral)] hover:bg-[#d05c42] text-white text-xs font-semibold shadow-sm hover:shadow transition-all active:scale-95 group shrink-0"
              >
                <span>Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            ) : (
              <Link
                href="/signup"
                className="flex items-center gap-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-[var(--coral)] hover:bg-[#d05c42] text-white text-xs font-semibold shadow-sm hover:shadow transition-all active:scale-95 group shrink-0"
              >
                <span>Get Started</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            )}
          </div>
        ) : (
          /* Dashboard / App pages header right side: Only Hamburger Menu */
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="relative" ref={drawerRef}>
              <button
                type="button"
                onClick={() => setDrawerOpen((prev) => !prev)}
                aria-label="Toggle App Menu"
                className="flex items-center justify-center w-10 h-10 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] hover:bg-[var(--bg-surface)] text-[var(--coffee)] transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                {drawerOpen ? <X className="w-5 h-5 text-[var(--coral)]" /> : <Menu className="w-5 h-5" />}
              </button>

              {/* Hamburger Dropdown Menu Drawer */}
              {drawerOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 rounded-3xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-2xl z-50 p-3.5 flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] overflow-y-auto">
                  {/* User Profile Summary */}
                  {isLoggedIn && (
                    <div className="p-3 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)]">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[var(--coral-light)] flex items-center justify-center shrink-0">
                          <UserIcon className="w-5 h-5 text-[var(--coral)]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <p className="text-xs font-bold text-[var(--coffee)] truncate">
                              {user?.name || tenant?.name || "User Account"}
                            </p>
                            {tenant && (
                              <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[var(--coral-light)] text-[var(--coral)]">
                                {tenant.plan}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[var(--text-muted)] truncate">
                            {user?.email || "Connected Tenant"}
                          </p>
                        </div>
                      </div>

                      {/* Upgrade Plan button or Active badge */}
                      <div className="mt-2.5 pt-2.5 border-t border-[var(--border-color)]">
                        {tenant?.plan?.toLowerCase() !== "pro" ? (
                          <button
                            type="button"
                            onClick={handleUpgradePlan}
                            disabled={upgrading}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-amber-500/15 via-[var(--coral-light)] to-purple-500/15 border border-amber-300 dark:border-amber-700/50 text-amber-800 dark:text-amber-300 hover:opacity-90 transition-all cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                              <span>{upgrading ? "Upgrading..." : "Upgrade Plan"}</span>
                            </div>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500 text-white">
                              Pro
                            </span>
                          </button>
                        ) : (
                          <div className="flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300">
                            <div className="flex items-center gap-2">
                              <Crown className="w-3.5 h-3.5 text-emerald-500" />
                              <span>Pro Plan Active</span>
                            </div>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Account Links */}
                  {isLoggedIn && (
                    <div>
                      <p className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                        Account Settings
                      </p>
                      <div className="space-y-1 mt-1">
                        <Link
                          href="/profile"
                          onClick={() => setDrawerOpen(false)}
                          className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                            pathname === "/profile"
                              ? "bg-[var(--coral-light)] text-[var(--coral)] font-semibold"
                              : "text-[var(--coffee)] hover:bg-[var(--bg-surface)]"
                          }`}
                        >
                          <UserIcon className="w-4 h-4 text-[var(--text-muted)]" />
                          <span>Profile &amp; Subscription</span>
                        </Link>
                        <Link
                          href="/connect"
                          onClick={() => setDrawerOpen(false)}
                          className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                            pathname === "/connect"
                              ? "bg-[var(--coral-light)] text-[var(--coral)] font-semibold"
                              : "text-[var(--coffee)] hover:bg-[var(--bg-surface)]"
                          }`}
                        >
                          <CreditCard className="w-4 h-4 text-[var(--text-muted)]" />
                          <span>API Key &amp; Billing</span>
                        </Link>
                        <Link
                          href="/change-password"
                          onClick={() => setDrawerOpen(false)}
                          className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                            pathname === "/change-password"
                              ? "bg-[var(--coral-light)] text-[var(--coral)] font-semibold"
                              : "text-[var(--coffee)] hover:bg-[var(--bg-surface)]"
                          }`}
                        >
                          <Lock className="w-4 h-4 text-[var(--text-muted)]" />
                          <span>Change Password</span>
                        </Link>
                      </div>
                    </div>
                  )}

                  {/* Platform Navigation */}
                  <div className="border-t border-[var(--border-color)] pt-2.5">
                    <p className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      Platform Navigation
                    </p>
                    <div className="space-y-1 mt-1">
                      {appNavLinks.map((link) => {
                        const Icon = link.icon;
                        const isActive = pathname === link.href;
                        return (
                          <Link
                            key={link.href}
                            href={link.href}
                            onClick={() => setDrawerOpen(false)}
                            className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                              isActive
                                ? "bg-[var(--coral-light)] text-[var(--coral)] font-semibold"
                                : "text-[var(--coffee)] hover:bg-[var(--bg-surface)]"
                            }`}
                          >
                            <Icon className="w-4 h-4 text-[var(--coral)]" />
                            <span>{link.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>

                  {/* Documentation (Matches Footer Documentation Section) */}
                  <div className="border-t border-[var(--border-color)] pt-2.5">
                    <p className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      Documentation
                    </p>
                    <div className="space-y-1 mt-1">
                      <Link
                        href="/about"
                        onClick={() => setDrawerOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                          pathname === "/about"
                            ? "bg-[var(--coral-light)] text-[var(--coral)] font-semibold"
                            : "text-[var(--coffee)] hover:bg-[var(--bg-surface)]"
                        }`}
                      >
                        <Info className="w-4 h-4 text-[var(--text-muted)]" />
                        <span>About HisaabLedger</span>
                      </Link>
                      <Link
                        href="/help/how-to-use"
                        onClick={() => setDrawerOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                          pathname === "/help/how-to-use"
                            ? "bg-[var(--coral-light)] text-[var(--coral)] font-semibold"
                            : "text-[var(--coffee)] hover:bg-[var(--bg-surface)]"
                        }`}
                      >
                        <Compass className="w-4 h-4 text-[var(--text-muted)]" />
                        <span>How to Use</span>
                      </Link>
                      <Link
                        href="/help/what-to-expect"
                        onClick={() => setDrawerOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                          pathname === "/help/what-to-expect"
                            ? "bg-[var(--coral-light)] text-[var(--coral)] font-semibold"
                            : "text-[var(--coffee)] hover:bg-[var(--bg-surface)]"
                        }`}
                      >
                        <Sparkles className="w-4 h-4 text-[var(--text-muted)]" />
                        <span>What to Expect</span>
                      </Link>
                      <Link
                        href="/help/faqs"
                        onClick={() => setDrawerOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                          pathname === "/help/faqs"
                            ? "bg-[var(--coral-light)] text-[var(--coral)] font-semibold"
                            : "text-[var(--coffee)] hover:bg-[var(--bg-surface)]"
                        }`}
                      >
                        <HelpCircle className="w-4 h-4 text-[var(--text-muted)]" />
                        <span>Frequently Asked Questions</span>
                      </Link>
                    </div>
                  </div>

                  {/* Log out / Log in option */}
                  <div className="border-t border-[var(--border-color)] pt-2.5">
                    {isLoggedIn ? (
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Log out</span>
                      </button>
                    ) : (
                      <Link
                        href="/login"
                        onClick={() => setDrawerOpen(false)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-[var(--coffee)] hover:bg-[var(--bg-surface)] transition-colors"
                      >
                        <LogIn className="w-4 h-4 text-[var(--coral)]" />
                        <span>Sign in</span>
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Upgrade Success Popup Modal */}
      {upgradeSuccess && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-md rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xl overflow-hidden p-6 text-center">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-[var(--coral)] to-purple-600" />

            <button
              onClick={() => {
                setUpgradeSuccess(false);
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
              You have upgraded your plan to <strong>Pro Tier</strong>. Your new limits and priority features are active immediately!
            </p>

            <div className="space-y-2 mb-6 text-left">
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs text-[var(--coffee)]">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>50,000 API calls & 5,000,000 tokens included</span>
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
                setUpgradeSuccess(false);
                if (typeof window !== "undefined") {
                  const url = new URL(window.location.href);
                  url.searchParams.delete("checkout");
                  window.history.replaceState({}, "", url.pathname + (url.search || ""));
                }
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-[var(--coral)] text-white text-xs font-bold hover:opacity-90 transition-all shadow-sm cursor-pointer"
            >
              Continue with Pro
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
