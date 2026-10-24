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
  Sun,
  Moon,
  User as UserIcon,
  LogIn,
  UserPlus,
} from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [tenant, setTenant] = useState<TenantMe | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");

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

    const savedTheme = localStorage.getItem("hisaabledger_theme") as "light" | "dark" | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    }
  }, [pathname]);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("hisaabledger_theme", nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
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

  const isLoggedIn = !!apiKey || !!user;

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-[var(--bg-base)]/85 border-b border-[var(--border-color)] transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 group">
            <HisaabLedgerLogo size={36} />
          </Link>

          {isLoggedIn && (
            <nav className="hidden sm:flex items-center gap-1 ml-2">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold"
                        : "text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface)]"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface)] transition-colors"
            title="Toggle Theme"
          >
            {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          {isLoggedIn ? (
            <div className="flex items-center gap-2">
              {tenant && (
                <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--bg-card)] border border-[var(--border-color)] text-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-semibold text-[var(--coffee)]">
                    {user?.name || tenant.name}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400">
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
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 text-white text-xs font-semibold hover:from-indigo-700 hover:to-indigo-800 transition-all shadow-sm"
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
