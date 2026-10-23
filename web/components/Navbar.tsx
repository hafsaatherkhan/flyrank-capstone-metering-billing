"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getStoredApiKey, clearStoredApiKey, apiFetch } from "@/lib/api";
import { TenantMe } from "@/lib/types";
import { KeyRound, Gauge, Terminal, ListChecks, LogOut, Sun, Moon } from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [tenant, setTenant] = useState<TenantMe | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const key = getStoredApiKey();
    setApiKey(key);
    if (key) {
      apiFetch<TenantMe>("/me").then((res) => {
        if (res.data) setTenant(res.data);
      });
    }

    const savedTheme = localStorage.getItem("flyrank_theme") as "light" | "dark" | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    }
  }, [pathname]);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("flyrank_theme", nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
  };

  const handleDisconnect = () => {
    clearStoredApiKey();
    setApiKey(null);
    setTenant(null);
    router.push("/connect");
  };

  const navLinks = [
    { href: "/dashboard", label: "Dashboard", icon: Gauge },
    { href: "/playground", label: "Playground", icon: Terminal },
    { href: "/events", label: "Events", icon: ListChecks },
  ];

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-[var(--bg-base)]/85 border-b border-[var(--border-color)] transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-[var(--burgundy)] to-[var(--coral)] flex items-center justify-center text-white font-bold text-sm shadow-sm transition-transform group-hover:scale-105">
              FR
            </span>
            <span className="font-bold tracking-tight text-lg text-[var(--coffee)]">
              Fly<span className="text-[var(--burgundy)]">Rank</span>
            </span>
          </Link>

          {apiKey && (
            <nav className="hidden sm:flex items-center gap-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-[var(--coral-light)] text-[var(--burgundy)]"
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
            aria-label="Toggle color theme"
            className="p-2 rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-surface)] text-[var(--text-muted)] transition-colors"
          >
            {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          {apiKey ? (
            <div className="flex items-center gap-3">
              {tenant && (
                <div className="hidden md:flex flex-col text-right leading-tight">
                  <span className="text-xs font-semibold text-[var(--text-main)]">{tenant.name}</span>
                  <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-mono">
                    {tenant.plan} plan
                  </span>
                </div>
              )}
              <button
                onClick={handleDisconnect}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-color)] hover:border-[var(--burgundy)] hover:text-[var(--burgundy)] text-xs font-medium transition-all"
                title="Disconnect API key"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Disconnect</span>
              </button>
            </div>
          ) : (
            <Link
              href="/connect"
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[var(--burgundy)] text-white text-xs font-semibold hover:bg-[var(--burgundy-hover)] transition-all shadow-sm"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Connect</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
