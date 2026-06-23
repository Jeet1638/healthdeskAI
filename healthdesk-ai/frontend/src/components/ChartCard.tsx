import type { ReactNode } from "react";

import { Skeleton } from "@/components/Skeleton";

export function ChartCard({
  title,
  loading,
  children,
}: {
  title: string;
  loading?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)] dark:border-slate-700 dark:bg-slate-800 dark:shadow-[0_10px_30px_rgba(0,0,0,0.2)]">
      <h2 className="text-lg font-bold text-[#0F172A] dark:text-slate-100">{title}</h2>
      {loading ? (
        <div className="mt-6 space-y-4">
          <Skeleton className="h-64 w-full" />
          <div className="grid grid-cols-4 gap-3">
            <Skeleton className="h-3" />
            <Skeleton className="h-3" />
            <Skeleton className="h-3" />
            <Skeleton className="h-3" />
          </div>
        </div>
      ) : (
        <div className="mt-5 h-72">{children}</div>
      )}
    </section>
  );
}
