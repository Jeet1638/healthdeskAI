import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AppointmentStatus, ConversationUrgency } from "@/types/api";

const urgencyClasses: Record<ConversationUrgency, string> = {
  low: "bg-[#D1FAE5] text-[#065F46] dark:bg-[#064E3B] dark:text-[#D1FAE5]",
  medium: "bg-[#FEF3C7] text-[#92400E] dark:bg-[#78350F] dark:text-[#FEF3C7]",
  high: "bg-[#FEE2E2] text-[#991B1B] dark:bg-[#7F1D1D] dark:text-[#FEE2E2]",
  emergency: "bg-[#EF4444] text-white",
};

const appointmentClasses: Record<AppointmentStatus, string> = {
  scheduled: "bg-[#CCFBF1] text-[#134E4A] dark:bg-[#0F766E] dark:text-white",
  rescheduled: "bg-[#FEF3C7] text-[#92400E] dark:bg-[#F59E0B] dark:text-[#0F172A]",
  cancelled: "bg-[#FEE2E2] text-[#991B1B] dark:bg-[#EF4444] dark:text-white",
  completed: "bg-[#D1FAE5] text-[#065F46] dark:bg-[#10B981] dark:text-[#052E2B]",
  no_show: "bg-[#F1F5F9] text-[#64748B] dark:bg-slate-700 dark:text-slate-100",
};

export function StatusBadge({
  status,
  type,
  className,
}: {
  status: ConversationUrgency | AppointmentStatus | string;
  type: "urgency" | "appointment" | "channel" | "patient";
  className?: string;
}) {
  const classes =
    type === "urgency"
      ? urgencyClasses[status as ConversationUrgency] ?? "bg-[#F1F5F9] text-[#64748B] dark:bg-slate-700 dark:text-slate-100"
      : type === "appointment"
        ? appointmentClasses[status as AppointmentStatus] ?? "bg-[#F1F5F9] text-[#64748B] dark:bg-slate-700 dark:text-slate-100"
        : type === "channel" && status === "voice"
          ? "bg-[#EDE9FE] text-[#5B21B6] dark:bg-[#5B21B6] dark:text-white"
          : type === "channel"
            ? "bg-[#DBEAFE] text-[#1E40AF] dark:bg-[#1E40AF] dark:text-white"
            : status === "new"
              ? "bg-[#CCFBF1] text-[#134E4A] dark:bg-[#0F766E] dark:text-white"
              : "bg-[#F1F5F9] text-[#64748B] dark:bg-slate-700 dark:text-slate-100";

  return (
    <Badge className={cn("w-fit rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em]", classes, className)}>
      {status.replace("_", " ")}
    </Badge>
  );
}
