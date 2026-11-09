"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

interface BackButtonProps {
  label?: string;
  fallbackHref?: string;
  className?: string;
}

export default function BackButton({
  label = "Back to HisaabLedger",
  fallbackHref = "/",
  className = "inline-flex items-center gap-2 rounded-full border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-2 text-xs font-semibold text-[var(--coffee)] shadow-sm transition-all hover:bg-[var(--coffee)] hover:text-[var(--coral)] hover:border-[var(--coffee)] cursor-pointer",
}: BackButtonProps) {
  const router = useRouter();

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  };

  return (
    <button type="button" onClick={handleBack} className={className}>
      <ArrowLeft size={14} /> {label}
    </button>
  );
}
