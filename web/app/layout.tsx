import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "FlyRank - Metering & Billing Demo",
  description: "Live demo of multi-tenant API metering, quota enforcement, and Polar billing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
          {children}
        </main>
        <footer className="border-t border-[var(--border-color)] py-6 text-center text-xs text-[var(--text-muted)]">
          FlyRank Capstone Demo • Evaluator Review Mode
        </footer>
      </body>
    </html>
  );
}
