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
  ChevronDown,
  Settings,
  CreditCard,
  Sparkles,
} from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [tenant, setTenant] = useState<TenantMe | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const key = getStoredApiKey();
    const token = getAccessToken();
    const currentUser = getStoredUser();

    setApiKey(key);
    setUser(currentUser);

    if (key || token) {
      apiFetch<TenantMe>("/me").then((res) => {
        if (res.data) setTenant(res.data);
      });
    }
  }, [pathname]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleLogout = async () => {
    setProfileOpen(false);
    // Server-side revoke
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

  const appNavLinks = [
    { href: "/dashboard", label: "Dashboard", icon: Gauge },
    { href: "/playground", label: "Playground", icon: Terminal },
    { href: "/events", label: "Events & Ledger", icon: ListChecks },
  ];

  const landingQuickLinks = [
    { href: "/#features", label: "Features" },
    { href: "/#how", label: "How It Works" },
    { href: "/about", label: "About" },
    { href: "/help/faqs", label: "FAQs" },
  ];

  // Detect if we're on a dashboard/app page
  const isAppPage = appNavLinks.some(
    (l) => pathname === l.href || pathname.startsWith(l.href + "/")
  );

  const isLoggedIn = !!apiKey || !!user;

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-[var(--bg-base)]/85 border-b border-[var(--border-color)] transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 group">
            <HisaabLedgerLogo size={36} />
          </Link>

          {/* Landing quick links — only on non-app pages */}
          {!isAppPage && (
            <nav className="hidden lg:flex items-center gap-1 ml-1 text-xs">
              {landingQuickLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-2.5 py-1.5 rounded-lg font-medium text-[var(--text-muted)] hover:text-[var(--coffee)] hover:bg-[var(--bg-surface)] transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          )}

          {/* App nav links — only on app pages when logged in */}
          {isAppPage && isLoggedIn && (
            <nav className="hidden sm:flex items-center gap-1 border-l border-[var(--border-color)] pl-3 ml-1">
              {appNavLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      isActive
                        ? "bg-[var(--coral-light)] text-[var(--coral)] font-semibold"
                        : "text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface)]"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {isLoggedIn ? (
            /* Profile Dropdown */
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen((v) => !v)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] hover:bg-[var(--bg-surface)] text-xs font-semibold text-[var(--coffee)] transition-all"
              >
                <span className="w-6 h-6 rounded-full bg-[var(--coral-light)] flex items-center justify-center">
                  <UserIcon className="w-3.5 h-3.5 text-[var(--coral)]" />
                </span>
                <span className="hidden sm:inline">
                  {user?.name?.split(" ")[0] || tenant?.name?.split(" ")[0] || "Account"}
                </span>
                {tenant && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[var(--coral-light)] text-[var(--coral)]">
                    {tenant.plan}
                  </span>
                )}
                <ChevronDown
                  className={`w-3 h-3 text-[var(--text-muted)] transition-transform ${
                    profileOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Dropdown Menu */}
              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-lg overflow-hidden z-50">
                  {/* User Info */}
                  <div className="px-4 py-3 border-b border-[var(--border-color)]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[var(--coral-light)] flex items-center justify-center shrink-0">
                        <UserIcon className="w-4 h-4 text-[var(--coral)]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[var(--coffee)] truncate">
                          {user?.name || tenant?.name || "User"}
                        </p>
                        <p className="text-[11px] text-[var(--text-muted)] truncate">
                          {user?.email || ""}
                        </p>
                      </div>
                    </div>
                    {tenant && (
                      <div className="mt-2 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[11px] text-[var(--text-muted)]">
                          Plan:{" "}
                          <span className="font-semibold text-[var(--coral)] uppercase">
                            {tenant.plan}
                          </span>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Menu Items */}
                  <div className="py-1">
                    <Link
                      href="/dashboard"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-[var(--text-muted)] hover:text-[var(--coffee)] hover:bg-[var(--bg-surface)] transition-colors"
                    >
                      <Gauge className="w-3.5 h-3.5" />
                      Dashboard
                    </Link>
                    <Link
                      href="/connect"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-[var(--text-muted)] hover:text-[var(--coffee)] hover:bg-[var(--bg-surface)] transition-colors"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      API Key & Billing
                    </Link>
                    {tenant && tenant.plan?.toLowerCase() !== "pro" && (
                      <Link
                        href="/dashboard"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        Upgrade to Pro
                      </Link>
                    )}
                  </div>

                  {/* Logout */}
                  <div className="py-1 border-t border-[var(--border-color)]">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-[var(--text-muted)] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Log out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-[var(--coffee)] hover:bg-[var(--bg-surface)] transition-all"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Login</span>
              </Link>
              <Link
                href="/signup"
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[var(--coral)] to-[var(--coral)] text-white text-xs font-semibold hover:opacity-90 transition-all shadow-sm"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Sign Up</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
