import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const faqs = [
  {
    q: "What exactly is HisaabLedger?",
    a: "HisaabLedger is an AI token metering and cost-accounting platform. It records every AI model call at the token level — separating prompt, cached, and output tokens — applies per-model pricing, and surfaces the result as auditable ledger events and interactive analytics charts.",
  },
  {
    q: "Which AI models are supported?",
    a: "The Simulator Playground supports GPT-4o, Claude 3.5 Sonnet, and Gemini 1.5 Pro, each with their real published input and output token pricing. Additional models can be added by extending the pricing table in the backend.",
  },
  {
    q: "What is 'sub-cent' cost calculation?",
    a: "Most AI billing rounds to the nearest cent, which can hide significant leakage at scale. HisaabLedger calculates cost to 8 decimal places — e.g. $0.00284 — so you see exact consumption, not approximations.",
  },
  {
    q: "How does the Analytics Switcher work?",
    a: "The Dashboard defaults to a Column chart showing cost per model. Use the dropdown or icon menu to instantly switch to Line (cost over time trend), Horizontal Bar (per-model comparison), or Pie (cost share breakdown) — all without a page reload.",
  },
  {
    q: "How does authentication work?",
    a: "HisaabLedger uses Neon Auth, which issues both an Access Token (short-lived, used for API calls) and a Refresh Token (longer-lived, stored securely). The app automatically refreshes your session in the background so you're never interrupted mid-session.",
  },
  {
    q: "Can I reset my password?",
    a: "Yes. Use the 'Forgot Password' link on the login page. You'll receive an OTP code by email. Enter the code, then set your new password. The same flow works via /forgot-password.",
  },
  {
    q: "What is a 'tenant' in HisaabLedger?",
    a: "A tenant is your isolated account unit. Every metering event, quota limit, and ledger entry belongs to exactly one tenant. Multi-tenancy means different teams or customers can be metered independently on the same platform without data leakage between accounts.",
  },
  {
    q: "What does 'quota enforcement' do?",
    a: "You can set a monthly token quota for your tenant. When cumulative consumption reaches that limit, the metering engine flags subsequent calls with an 'over_quota' status in the ledger and can trigger rate-limiting — giving you hard budget controls on AI spend.",
  },
  {
    q: "What is the Simulator Playground?",
    a: "The Playground lets you simulate AI calls without calling real paid model APIs. Select a model, enter prompt and completion token counts, and instantly see the calculated cost. It's ideal for estimating spend before committing to a pricing tier.",
  },
  {
    q: "Where are my ledger events stored?",
    a: "All events are stored in PostgreSQL on Neon — a serverless, always-on managed database. Rows are immutable once written, ensuring your audit trail is tamper-evident. You can inspect every event, timestamp, token count, and cost on the /events page.",
  },
  {
    q: "Do I receive an email when I sign up?",
    a: "Yes. A welcome email is sent automatically by the FastAPI backend using a background email service the moment your account is created. It confirms your tenant ID and provides links to get started.",
  },
  {
    q: "Is there a free tier?",
    a: "The platform is open for use — create an account, connect your API key, and start metering. The Capstone version includes a default quota that covers generous experimentation. Check your Dashboard for your current plan and usage.",
  },
];

export default function FaqsPage() {
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
          Help
        </span>
        <h1 className="mt-4 font-grotesk text-[clamp(2.5rem,5vw,3.75rem)] font-semibold leading-tight tracking-[-0.04em] text-[var(--coffee)]">
          Frequently Asked Questions
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
          Everything you need to know about metering, billing, auth, and the platform.
        </p>
      </div>

      <div className="space-y-4">
        {faqs.map(({ q, a }) => (
          <details
            key={q}
            className="group rounded-[1.5rem] border border-[var(--border-color)] bg-[var(--bg-card)] open:shadow-sm transition-all"
          >
            <summary className="flex cursor-pointer items-center justify-between gap-4 px-7 py-5 font-grotesk text-base font-semibold tracking-[-0.02em] text-[var(--coffee)] list-none">
              {q}
              <span className="shrink-0 grid size-6 place-items-center rounded-full border border-[var(--border-color)] text-[var(--muted)] group-open:bg-[var(--coral)] group-open:text-white group-open:border-[var(--coral)] transition-all text-xs font-bold">
                +
              </span>
            </summary>
            <p className="px-7 pb-6 pt-1 text-[15px] leading-relaxed text-[var(--muted)]">{a}</p>
          </details>
        ))}
      </div>

      <div className="mt-12 rounded-[2rem] border border-[var(--border-color)] bg-[var(--coral-light)] p-8 md:p-10">
        <h2 className="font-grotesk text-xl font-semibold tracking-[-0.02em] text-[var(--coffee)]">
          Still have questions?
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--muted)]">
          Browse the full documentation or head straight to the platform to explore HisaabLedger hands-on.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/help/how-to-use"
            className="inline-flex items-center gap-2 rounded-full bg-[var(--coffee)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--coral)] transition-all"
          >
            How to Use Guide →
          </Link>
          <Link
            href="/help/what-to-expect"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--border-color)] bg-[var(--bg-card)] px-5 py-2.5 text-sm font-semibold text-[var(--coffee)] hover:bg-[var(--bg-surface)] transition-all"
          >
            What to Expect →
          </Link>
        </div>
      </div>
    </div>
  );
}
