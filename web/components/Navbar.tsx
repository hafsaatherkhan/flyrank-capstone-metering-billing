"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
  User as UserIcon,
  LogIn,
  UserPlus,
  MousePointer,
  Sparkles,
  Info,
} from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [tenant, setTenant] = useState<TenantMe | null>(null);
  const [cursorEnabled, setCursorEnabled] = useState<boolean>(true);

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

  const toggleCursor = () => {
    const next = !cursorEnabled;
    setCursorEnabled(next);
    localStorage.setItem("hl-cursor", next ? "on" : "off");
    window.dispatchEvent(new CustomEvent("hl-cursor-change", { detail: { enabled: next } }));
  };

  const handleLogout = () => {
    clearSession();
    setApiKey(null);
    setUser(null);
    setTenant(null);
    router.push("/login");
  };

  const navLinks = [
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

  const isLoggedIn = !!apiKey || !!user;

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-[var(--bg-base)]/85 border-b border-[var(--border-color)] transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 group">
            <HisaabLedgerLogo size={36} />
          </Link>

          {/* Quick Navigations */}
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

          {isLoggedIn && (
            <nav className="hidden sm:flex items-center gap-1 border-l border-[var(--border-color)] pl-3 ml-1">
              {navLinks.map((link) => {
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
          {/* Custom Cursor Toggle Button */}
          <button
            type="button"
            onClick={toggleCursor}
            title={cursorEnabled ? "Disable custom interactive cursor" : "Enable custom interactive cursor"}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
              cursorEnabled
                ? "border-[var(--coral)]/40 bg-[var(--coral-light)] text-[var(--coral)]"
                : "border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--coffee)] hover:bg-[var(--bg-surface)]"
            }`}
          >
            <MousePointer className={`w-3.5 h-3.5 ${cursorEnabled ? "text-[var(--coral)]" : "opacity-60"}`} />
            <span className="hidden sm:inline font-mono text-[11px]">
              Cursor: {cursorEnabled ? "ON" : "OFF"}
            </span>
          </button>

          {isLoggedIn ? (
            <div className="flex items-center gap-2">
              {tenant && (
                <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--bg-card)] border border-[var(--border-color)] text-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-semibold text-[var(--coffee)]">
                    {user?.name || tenant.name}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[var(--coral-light)] text-[var(--coral)]">
                    {tenant.plan}
                  </span>
                </div>
              )}

              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border-color)] text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-950/30 hover:border-red-200 dark:hover:border-red-900/50 hover:text-red-600 transition-all text-[var(--text-muted)]"
                title="Log out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
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
