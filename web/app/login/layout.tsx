import { ReactNode } from "react";

export default function SubRouteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
      {children}
    </div>
  );
}
