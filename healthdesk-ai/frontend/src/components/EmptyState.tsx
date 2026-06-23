import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  message,
}: {
  icon: LucideIcon;
  title: string;
  message: string;
}) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-[#E2E8F0] bg-white px-6 py-10 text-center shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <div className="mb-4 rounded-full bg-[#F0FDFA] p-3 text-[#0F766E]">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="text-lg font-bold text-[#0F172A]">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-[#64748B]">{message}</p>
    </div>
  );
}
