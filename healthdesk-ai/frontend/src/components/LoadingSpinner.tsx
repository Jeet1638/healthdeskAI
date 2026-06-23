import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export function LoadingSpinner({
  className,
  label = "Loading",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 text-sm font-medium text-[#64748B]">
      <Loader2 className={cn("h-4 w-4 animate-spin text-[#0F766E]", className)} />
      <span>{label}</span>
    </span>
  );
}
