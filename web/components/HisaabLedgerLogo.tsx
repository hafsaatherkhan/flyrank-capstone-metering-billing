import React from "react";

interface LogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
  textColor?: "default" | "light";
}

/**
 * Reusable HisaabLedger Brand Icon / Mark
 */
export function HisaabLedgerMark({
  size = 36,
  rounded = "rounded-xl",
  className = "",
}: {
  size?: number;
  rounded?: string;
  className?: string;
}) {
  return (
    <div
      style={{ width: size, height: size }}
      className={`relative shrink-0 ${rounded} shadow-md overflow-hidden flex items-center justify-center bg-gradient-to-br from-[#2e1e1a] via-[#442e28] to-[#7d1d2e] border border-[var(--coral)]/30 ${className}`}
    >
      <svg
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-[82%] h-[82%]"
      >
        {/* Subtle Ledger Grid Background */}
        <line x1="8" y1="20" x2="56" y2="20" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" strokeDasharray="2 2" />
        <line x1="8" y1="34" x2="56" y2="34" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" strokeDasharray="2 2" />
        <line x1="8" y1="48" x2="56" y2="48" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" strokeDasharray="2 2" />
        <line x1="28" y1="12" x2="28" y2="52" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />

        {/* Golden / Amber Ledger Spine Accent */}
        <path
          d="M12 10C10.8954 10 10 10.8954 10 12V52C10 53.1046 10.8954 54 12 54H16V10H12Z"
          fill="url(#goldGrad)"
        />

        {/* Stylized 'H' and Ascending Analytics Bars */}
        {/* Left Vertical Beam */}
        <rect x="20" y="16" width="6" height="32" rx="3" fill="#ffffff" />
        
        {/* Horizontal Balance Bridge */}
        <rect x="23" y="29" width="18" height="5" rx="2.5" fill="#f59e0b" />
        
        {/* Right Vertical Bar (Dynamic Metering Columns) */}
        <rect x="35" y="24" width="6" height="24" rx="3" fill="#e06d53" />
        <rect x="44" y="14" width="6" height="34" rx="3" fill="#f28b74" />

        {/* Sparkle Node */}
        <circle cx="47" cy="14" r="2.5" fill="#fbbf24" />

        <defs>
          <linearGradient id="goldGrad" x1="10" y1="10" x2="16" y2="54" gradientUnits="userSpaceOnUse">
            <stop stopColor="#f59e0b" />
            <stop offset="1" stopColor="#d97706" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

export default function HisaabLedgerLogo({
  className = "",
  size = 36,
  showText = true,
  textColor = "default",
}: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 group cursor-pointer select-none ${className}`}>
      <HisaabLedgerMark size={size} className="transition-all duration-300 group-hover:scale-105 group-hover:shadow-lg" />

      {showText && (
        <div className="flex flex-col">
          <div
            className={`flex items-center tracking-tight leading-none font-extrabold text-[1.18rem] font-sans ${
              textColor === "light" ? "text-white" : "text-[var(--coffee)] dark:text-zinc-100"
            }`}
          >
            <span>Hisaab</span>
            <span className="bg-gradient-to-r from-amber-500 via-[var(--coral)] to-[var(--coral)] bg-clip-text text-transparent ml-0.5">
              Ledger
            </span>
          </div>
          <span
            className={`text-[9px] uppercase tracking-widest font-semibold mt-0.5 ${
              textColor === "light" ? "text-white/60" : "text-[var(--text-muted)]"
            }`}
          >
            Precision Metering & AI Accounting
          </span>
        </div>
      )}
    </div>
  );
}
