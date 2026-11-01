import { ReactNode } from "react";

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-6">
      {children}
    </div>
  );
}
