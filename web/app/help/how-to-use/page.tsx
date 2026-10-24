import Link from "next/link";
import { ArrowLeft, Terminal, KeyRound, Gauge, ListChecks } from "lucide-react";

export default function HowToUsePage() {
  const steps = [
    {
      n: "01",
      Icon: KeyRound,
      title: "Create Your Account",
      body: "Sign up at /signup with your email and password. You'll receive a welcome email confirming your tenant account. Your tenant is isolated — your data, quotas, and ledger are entirely private.",
      link: { href: "/signup", label: "Go to Sign Up" },
    },
    {
      n: "02",
      Icon: Terminal,
      title: "Connect Your API Key",
      body: "Head to the Connect page and paste your API key. This registers your tenant and links every subsequent metering event to your account. You can also test the connection with a single click.",
      link: { href: "/connect", label: "Open Connect" },
    },
    {
      n: "03",
      Icon: Terminal,
      title: "Run the Simulator Playground",
      body: "Use the Playground to simulate AI calls across GPT-4o, Claude 3.5, and Gemini 1.5 models. Select a model, enter prompt and completion token counts, and instantly see the sub-cent cost breakdown — no real API spend needed.",
      link: { href: "/playground", label: "Open Playground" },
    },
    {
      n: "04",
      Icon: Gauge,
      title: "Inspect the Analytics Dashboard",
      body: "The Dashboard shows your total tokens, total cost, and per-model cost breakdowns. Use the chart switcher (Column → Line → Bar → Pie) to view consumption from any angle. Filter by date range for focused reporting.",
      link: { href: "/dashboard", label: "Open Dashboard" },
    },
    {
      n: "05",
      Icon: ListChecks,
      title: "Audit the Ledger Events",
      body: "Every metering call is logged as an immutable ledger event. Browse the Events page to filter by status (success / error), sort by timestamp, and inspect the exact token counts and calculated cost for each request.",
      link: { href: "/events", label: "Open Events" },
    },
  ];

  return (
    <div className="mx-auto max-w-[1140px] px-6 py-12 md:py-16">
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-full border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-2 text-xs font-semibold text-[var(--coffee)] shadow-sm transition-all hover:bg-[var(--coffee)] hover:text-[var(--coral)] hover:border-[var(--coffee)]"
      >
        <ArrowLeft size={14} /> Back to HisaabLedger
      </Link>

      <div className="my-10">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-color)] bg-[var(--coral-light)] px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--coral)]">
          Step-by-step Guide
        </span>
        <h1 className="mt-4 font-grotesk text-[clamp(2.5rem,5vw,3.75rem)] font-semibold leading-tight tracking-[-0.04em] text-[var(--coffee)]">
          How to Use HisaabLedger
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
          From account creation to reading your first auditable cost ledger — five steps to full
          AI metering visibility.
        </p>
      </div>

      <div className="space-y-5">
        {steps.map(({ n, Icon, title, body, link }) => (
          <section
            key={n}
            className="flex gap-6 rounded-[2rem] border border-[var(--border-color)] bg-[var(--bg-card)] p-7 md:p-10 shadow-sm"
          >
            <div className="flex flex-col items-center gap-2 pt-1">
              <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--coral-light)] text-[var(--coral)]">
                <Icon size={20} />
              </div>
              <div className="text-[10px] font-mono font-bold text-[var(--muted)]">{n}</div>
            </div>
            <div className="flex-1">
              <h2 className="font-grotesk text-xl font-semibold tracking-[-0.02em] text-[var(--coffee)]">
                {title}
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-[var(--muted)]">{body}</p>
              <Link
                href={link.href}
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--coral)] hover:underline underline-offset-4"
              >
                {link.label} →
              </Link>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
