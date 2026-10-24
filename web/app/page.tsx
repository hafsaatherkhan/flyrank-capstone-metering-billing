"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useMotionValue, useScroll, useSpring, useTransform } from "framer-motion";
import { ShieldCheck, Zap, BarChart3, UserPlus, LogIn } from "lucide-react";
import HisaabLedgerLogo, { HisaabLedgerMark } from "@/components/HisaabLedgerLogo";
import "./landing.css";

const ease = [0.16, 1, 0.3, 1] as const;

function Arrow() {
  return (
    <svg viewBox="0 0 20 20" className="size-4 w-4 h-4" aria-hidden="true">
      <path
        d="M3 10h13M11 5l5 5-5 5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function Marquee({ reverse = false }: { reverse?: boolean }) {
  const metrics = [
    "Sub-Cent Token Metering",
    "Quota Enforcement",
    "Real-Time Analytics",
    "Multi-Tenant Isolation",
    "Tamper-Evident Ledger",
    "Neon Auth Sessions",
  ];
  return (
    <div className="overflow-hidden border-y border-[var(--line)] py-4">
      <motion.div
        className="flex w-max items-center"
        animate={{ x: reverse ? ["-50%", "0%"] : ["0%", "-50%"] }}
        transition={{ duration: 28, ease: "linear", repeat: Infinity }}
      >
        {[0, 1].map((g) => (
          <div
            key={g}
            className="flex items-center gap-8 pr-8 text-[clamp(2rem,4vw,4rem)] font-medium uppercase leading-none tracking-[-.06em] font-grotesk"
          >
            {metrics.map((item) => (
              <span key={item} className="flex items-center gap-8 whitespace-nowrap">
                <span>{item}</span>
                <HisaabLedgerLogo
                  size={28}
                  showText={false}
                  className="shrink-0 text-[var(--coral)] md:size-10"
                />
              </span>
            ))}
          </div>
        ))}
      </motion.div>
    </div>
  );
}

export default function Home() {
  const heroRef = useRef<HTMLElement>(null);
  const [cursorMotion, setCursorMotion] = useState(true);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const cursorX = useSpring(mouseX, { stiffness: 90, damping: 20 });
  const cursorY = useSpring(mouseY, { stiffness: 90, damping: 20 });
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const titleY = useTransform(scrollYProgress, [0, 1], [0, 180]);
  const titleScale = useTransform(scrollYProgress, [0, 0.8], [1, 0.84]);
  const cardRotate = useTransform(scrollYProgress, [0, 1], [-7, 10]);

  useEffect(() => {
    const saved = localStorage.getItem("hl-cursor");
    if (saved !== null) setCursorMotion(saved !== "off");

    const handleCursorSync = (e: any) => {
      if (e.detail?.enabled !== undefined) {
        setCursorMotion(e.detail.enabled);
      }
    };
    window.addEventListener("hl-cursor-change" as any, handleCursorSync);
    return () => {
      window.removeEventListener("hl-cursor-change" as any, handleCursorSync);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("hl-cursor", cursorMotion ? "on" : "off");
  }, [cursorMotion]);

  return (
    <main
      className="relative w-full -my-8 -mx-4 sm:-mx-6 overflow-x-hidden bg-[var(--paper)]"
      onPointerMove={(e) => {
        mouseX.set(e.clientX);
        mouseY.set(e.clientY);
      }}
    >
      {cursorMotion && (
        <motion.div
          className="pointer-events-none fixed z-[80] hidden size-4 w-4 h-4 rounded-full bg-[var(--coral)] mix-blend-difference md:block"
          style={{ left: cursorX, top: cursorY, x: "-50%", y: "-50%" }}
        />
      )}

      {/* ─── HERO — same absolute-card structure as capstone ─── */}
      <section
        ref={heroRef}
        className="relative min-h-[900px] overflow-hidden bg-[var(--paper)] px-5 pb-20 pt-40 md:min-h-[1020px] md:px-10 md:pt-48"
      >
        <div className="absolute inset-0 grain pointer-events-none" />

        {/* Scroll-parallax title block */}
        <motion.div
          style={{ y: titleY, scale: titleScale }}
          className="relative z-10 mx-auto max-w-[1500px]"
        >
          {/* Tagline — same style as capstone */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease }}
            className="mb-7 flex items-center gap-3 text-xs uppercase tracking-[.18em] text-[var(--muted)]"
          >
            <span className="h-px w-10 bg-current" />
            AI Token Metering &amp; Cost Intelligence
          </motion.div>

          <h1 className="font-grotesk text-[clamp(4.3rem,12.4vw,12.8rem)] font-medium leading-[.75] tracking-[-.085em]">
            <motion.span
              initial={{ x: "-15%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 1.1, ease }}
              className="block"
            >
              EVERY TOKEN.
            </motion.span>
            <motion.span
              initial={{ x: "15%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 1.1, delay: 0.08, ease }}
              className="block text-right text-outline"
            >
              ACCOUNTED FOR.
            </motion.span>
          </h1>
        </motion.div>

        {/* Left floating card — scroll-tilt (coffee bg) */}
        <motion.div
          style={{ rotate: cardRotate }}
          className="absolute left-[6%] top-[62%] hidden w-52 rounded-3xl bg-[var(--coffee)] p-5 text-white shadow-xl md:block"
        >
          <p className="text-[10px] uppercase tracking-widest text-[var(--coral)] opacity-80 font-mono">
            Inbound AI Call
          </p>
          <p className="mt-14 font-grotesk text-2xl font-semibold leading-tight">
            1,420 tokens
          </p>
          <p className="mt-1 text-[11px] text-white/55">Prompt: 820 · Completion: 600</p>
          <div className="mt-3 inline-block font-mono text-[10px] px-2 py-0.5 rounded bg-white/10 text-[#f6d99a]">
            $0.00284 USD
          </div>
        </motion.div>

        {/* Right floating card — float animation (cream bg) */}
        <motion.div
          animate={{ y: [0, -18, 0], rotate: [5, 2, 5] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute right-[6%] top-[56%] w-44 rounded-3xl bg-[var(--coral-light)] p-5 shadow-xl md:w-60 border border-[var(--coral)]/20"
        >
          <div className="flex justify-between items-center text-[10px] uppercase tracking-widest text-[var(--coffee)] opacity-60 font-mono">
            <span>Quota Status</span>
            <span className="bg-[var(--coral)] text-white px-1.5 py-0.5 rounded-full opacity-100">ACTIVE</span>
          </div>
          <div className="mt-10 space-y-2">
            <div className="flex justify-between text-xs text-[var(--coffee)]">
              <span>Tenant Quota</span>
              <span className="font-semibold">82%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-[var(--border-color)] overflow-hidden">
              <div className="h-full bg-[var(--coral)] w-[82%]" />
            </div>
            <p className="text-[10px] text-[var(--muted)]">Rate-limit policy enforced</p>
          </div>
        </motion.div>

        {/* Centre spinning HisaabLedger rotatory logo */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[12%] left-[47%] flex items-center justify-center rounded-full shadow-2xl cursor-pointer hover:scale-110 transition-transform"
        >
          <HisaabLedgerMark size={84} rounded="rounded-full" className="md:hidden border-2 border-[var(--coral)]/40 shadow-xl" />
          <HisaabLedgerMark size={112} rounded="rounded-full" className="hidden md:flex border-2 border-[var(--coral)]/40 shadow-xl" />
        </motion.div>

        {/* Bottom-left narrative + CTA — absolute like capstone */}
        <div className="absolute bottom-10 left-5 z-10 max-w-[380px] md:left-10">
          <p className="text-base leading-relaxed text-[var(--muted)]">
            Turn opaque AI consumption into tamper-evident ledgers, granular tenant analytics, and sub-cent billing precision.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--coffee)] px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-[var(--coral)] transition-all hover:-translate-y-0.5"
            >
              <UserPlus className="w-4 h-4" />
              Get Started Free
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] px-5 py-2.5 text-sm font-semibold text-[var(--coffee)] hover:bg-[var(--bg-surface)] transition-all"
            >
              <LogIn className="w-4 h-4" />
              Login
            </Link>
          </div>
        </div>
      </section>

      {/* ─── MARQUEE ─── */}
      <section className="bg-[var(--coffee)] py-5 text-white">
        <Marquee />
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="how" className="bg-[var(--coffee)] px-5 py-28 text-white md:px-10 md:py-40">
        <div className="mx-auto max-w-[1400px]">
          <div className="grid gap-12 md:grid-cols-[1fr_1.7fr]">
            <div className="text-xs uppercase tracking-[.18em] text-white/50">01 — The system</div>
            <motion.h2
              initial={{ opacity: 0, y: 80 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-15%" }}
              transition={{ duration: 1, ease }}
              className="font-grotesk text-[clamp(3.2rem,7vw,7.6rem)] font-medium leading-[.9] tracking-[-.065em]"
            >
              From raw API calls to{" "}
              <span className="text-[var(--coral)]">auditable</span> financial intelligence.
            </motion.h2>
          </div>

          <div className="mt-24 grid gap-4 lg:grid-cols-3">
            {[
              {
                n: "01",
                title: "Meter Every Call",
                copy: "Ingest prompt, cached, and output tokens per tenant in real-time with zero latency overhead.",
                color: "var(--paper)",
                fg: "var(--coffee)",
                href: "/playground",
                Icon: Zap,
              },
              {
                n: "02",
                title: "Enforce & Budget",
                copy: "Set per-tenant quotas, tiered unit pricing, and proactive usage alerts before bills blow out.",
                color: "var(--coral)",
                fg: "#ffffff",
                href: "/dashboard",
                Icon: ShieldCheck,
              },
              {
                n: "03",
                title: "Visualise Costs",
                copy: "Switch between Column, Line, Bar, and Pie charts to dissect spend per model or user.",
                color: "var(--coral-light)",
                fg: "var(--coffee)",
                href: "/dashboard",
                Icon: BarChart3,
              },
            ].map((card, i) => (
              <motion.article
                key={card.n}
                initial={{ opacity: 0, y: 70 }}
                whileInView={{ opacity: 1, y: 0 }}
                whileHover={{ y: -12, rotate: i === 1 ? 1.5 : -1.5 }}
                viewport={{ once: true, margin: "-10%" }}
                transition={{ duration: 0.75, delay: i * 0.1, ease }}
                style={{ background: card.color, color: card.fg }}
                className="group flex min-h-[460px] flex-col justify-between rounded-[2rem] p-7 md:p-9"
              >
                <div className="flex items-center justify-between text-xs uppercase tracking-[.18em]">
                  <span>{card.n}</span>
                  <div className="size-8 w-8 h-8 rounded-full bg-black/10 grid place-items-center">
                    <card.Icon className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <h3 className="font-grotesk text-4xl font-medium tracking-[-.05em] md:text-5xl">
                    {card.title}
                  </h3>
                  <p className="mt-5 max-w-xs leading-relaxed opacity-70 text-sm">{card.copy}</p>
                  <Link
                    href={card.href}
                    className="mt-6 inline-flex items-center gap-2 font-medium text-sm underline underline-offset-4"
                  >
                    Open in workspace <Arrow />
                  </Link>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CAPABILITIES ─── */}
      <section id="features" className="bg-[var(--paper)] py-28 md:py-40">
        <div className="px-5 md:px-10">
          <p className="mx-auto mb-14 max-w-[1400px] text-xs uppercase tracking-[.18em] text-[var(--muted)]">
            02 — Ledger capabilities
          </p>
        </div>
        {[
          { text: "Real-time analytics switcher", sub: "Column, Line, Bar & Pie — zero reload", href: "/dashboard" },
          { text: "Sub-cent cost calculation", sub: "Input · Cached · Output token isolation", href: "/playground" },
          { text: "Auditable ledger events", sub: "Every call logged with verifiable breakdown", href: "/events" },
          { text: "Neon auth & dual tokens", sub: "Access & refresh sessions, Google SSO", href: "/login" },
        ].map((item, i) => (
          <Link key={item.text} href={item.href} className="block text-inherit">
            <motion.div
              initial="idle"
              whileHover="hover"
              className="relative border-t border-[var(--line)] px-5 py-7 last:border-b md:px-10 md:py-10 transition-colors hover:bg-black/[0.02]"
            >
              <motion.div
                variants={{ idle: { x: 0 }, hover: { x: 24 } }}
                transition={{ duration: 0.45, ease }}
                className="mx-auto flex max-w-[1400px] items-center justify-between gap-8"
              >
                <div className="flex items-center gap-5 md:gap-12">
                  <span className="text-xs text-[var(--muted)]">0{i + 1}</span>
                  <div>
                    <h3 className="font-grotesk text-[clamp(1.8rem,4vw,4.5rem)] font-medium leading-none tracking-[-.055em]">
                      {item.text}
                    </h3>
                    <p className="mt-1 text-sm text-[var(--muted)]">{item.sub}</p>
                  </div>
                </div>
                <motion.span
                  variants={{
                    idle: { rotate: 0, backgroundColor: "var(--paper)" },
                    hover: { rotate: 45, backgroundColor: "var(--coral)" },
                  }}
                  className="grid size-12 w-12 h-12 shrink-0 place-items-center rounded-full text-[var(--coffee)] md:size-16 md:w-16 md:h-16"
                >
                  <Arrow />
                </motion.span>
              </motion.div>
            </motion.div>
          </Link>
        ))}
      </section>

      {/* ─── CTA ─── */}
      <section
        id="start"
        className="relative overflow-hidden bg-[var(--coral)] px-5 py-28 text-[var(--coffee)] md:px-10 md:py-44"
      >
        {/* Rotatory HisaabLedger logo watermark */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
          className="absolute -right-28 -top-28 pointer-events-none opacity-[0.14] select-none"
          aria-hidden="true"
        >
          <HisaabLedgerMark size={580} rounded="rounded-[90px]" className="!shadow-none !border-none" />
        </motion.div>

        <div className="relative z-10 mx-auto max-w-[1400px]">
          <p className="mb-7 text-xs uppercase tracking-[.18em]">
            Accurate metering. Clear accounting.
          </p>
          <h2 className="max-w-5xl font-grotesk text-[clamp(4rem,10vw,10rem)] font-medium leading-[.78] tracking-[-.08em]">
            CONTROL YOUR
            <br />
            AI CONSUMPTION.
          </h2>
          <div className="mt-14 flex flex-col items-start justify-between gap-8 border-t border-[var(--coffee)]/20 pt-8 md:flex-row md:items-center">
            <p className="max-w-md text-lg leading-relaxed opacity-80">
              Launch metering in under 5 minutes. Streamline multi-tenant billing, quotas, and live analytics.
            </p>
            <Link href="/signup">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-5 rounded-full bg-[var(--coffee)] px-7 py-5 text-sm font-semibold text-white shadow-xl hover:shadow-2xl transition-all cursor-pointer"
              >
                Launch your ledger free <Arrow />
              </motion.button>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── FOOTER — exact capstone structure ─── */}
      <footer className="site-footer">
        <div className="site-footer__inner">

          {/* Brand */}
          <div className="site-footer__brand">
            <Link href="/" className="inline-flex items-center">
              <HisaabLedgerLogo size={42} showText={true} textColor="light" />
            </Link>
            <p className="site-footer__tagline">
              Precision AI Token Metering, Multi-Tenant Accounting &amp; Real-Time Usage Intelligence.
              Engineered to eliminate billing leakage and deliver transparent sub-cent analytics.
            </p>
            <div className="site-footer__creator">
              Built by{" "}
              <a
                href="https://www.linkedin.com/in/hafsa-ather-khan"
                target="_blank"
                rel="noopener noreferrer"
              >
                Hafsa Ather Khan
              </a>{" "}
              for the 10x Solution Capstone
            </div>
          </div>

          {/* Platform */}
          <div className="site-footer__group">
            <h4>Platform</h4>
            <ul>
              <li><Link href="/dashboard">Analytics Dashboard</Link></li>
              <li><Link href="/playground">Simulator Playground</Link></li>
              <li><Link href="/events">Events &amp; Ledger</Link></li>
              <li><Link href="/connect">API Key Connect</Link></li>
            </ul>
          </div>

          {/* Documentation */}
          <div className="site-footer__group">
            <h4>Documentation</h4>
            <ul>
              <li><Link href="/about">About HisaabLedger</Link></li>
              <li><Link href="/help/how-to-use">How to Use</Link></li>
              <li><Link href="/help/what-to-expect">What to Expect</Link></li>
              <li><Link href="/help/faqs">Frequently Asked Questions</Link></li>
            </ul>
          </div>

          {/* System */}
          <div className="site-footer__group">
            <h4>System</h4>
            <div className="site-footer__status">
              <span className="status-indicator-dot" />
              <span>Metering ingestion live</span>
            </div>
            <p className="site-footer__notes">
              Protected by FastAPI rate limiting, Neon Auth session isolation, and PostgreSQL row-level security.
            </p>
          </div>
        </div>

        <div className="site-footer__bottom">
          <div className="site-footer__bottom-inner">
            <span>&copy; 2026 HisaabLedger. Precision Metering &amp; AI Ledger Platform.</span>
            <div className="site-footer__bottom-links">
              <Link href="/help/faqs">Help</Link>
              <Link href="/about">About</Link>
              <Link href="/login">Sign in</Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
