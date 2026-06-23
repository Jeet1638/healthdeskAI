import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function AuthShell({
  title,
  subtitle,
  children,
  wide = false,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#F8FAFC] px-4 py-8 sm:px-6">
      <section
        className={cn(
          "flex w-full min-w-0 justify-center",
          wide ? "max-w-lg" : "max-w-sm",
        )}
      >
        <div
          className={cn(
            "w-full min-w-0 overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_18px_48px_rgba(15,23,42,0.07)]",
            wide ? "p-5 sm:p-6" : "p-5 sm:p-6",
          )}
        >
          <div className="mb-5">
            <h2 className="text-2xl font-bold text-[#0F172A]">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-[#64748B]">{subtitle}</p>
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
