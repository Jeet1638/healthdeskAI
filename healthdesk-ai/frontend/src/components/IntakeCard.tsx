"use client";

import { ClipboardList, ExternalLink } from "lucide-react";
import Link from "next/link";

import { LoadingSpinner } from "@/components/LoadingSpinner";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import type { IntakeForm } from "@/types/api";

export function IntakeCard({
  intake,
  onGenerateSummary,
  generating,
}: {
  intake: IntakeForm;
  onGenerateSummary: (intake: IntakeForm) => void;
  generating?: boolean;
}) {
  const missing = intake.missing_fields ?? [];

  return (
    <article className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-full bg-[#F0FDFA] p-2 text-[#0F766E]">
              <ClipboardList className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-bold text-[#0F172A]">{intake.patient_name ?? "Unknown patient"}</h2>
            {intake.urgency ? <StatusBadge status={intake.urgency} type="urgency" /> : null}
          </div>
          <p className="mt-3 text-sm font-semibold text-[#0F172A]">
            {intake.reason_for_visit || "No reason for visit captured"}
          </p>
          <p className="mt-1 text-sm text-[#64748B]">
            Submitted {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(intake.created_at))}
          </p>
        </div>
        {intake.conversation_id ? (
          <Button asChild variant="outline" className="rounded-xl border-[#CBD5E1] text-[#0F766E] hover:bg-[#F0FDFA]">
            <Link href={`/conversations/${intake.conversation_id}`}>
              <ExternalLink className="mr-2 h-4 w-4" />
              View Full Conversation
            </Link>
          </Button>
        ) : null}
      </div>

      {missing.length > 0 ? (
        <div className="mt-4 rounded-r-xl border-l-4 border-[#F59E0B] bg-[#FEF3C7] px-4 py-3 text-sm font-semibold text-[#92400E]">
          Incomplete intake — missing: {missing.join(", ")}
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl bg-[#F0FDFA] p-4">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#134E4A]">AI Summary</p>
        {intake.ai_summary ? (
          <p className="mt-2 text-sm leading-6 text-[#1E293B]">{intake.ai_summary}</p>
        ) : (
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[#64748B]">No summary has been generated for this intake yet.</p>
            <Button
              type="button"
              className="rounded-xl bg-[#0F766E] text-white hover:bg-[#0D9488]"
              disabled={!intake.conversation_id || generating}
              onClick={() => onGenerateSummary(intake)}
            >
              {generating ? <LoadingSpinner label="Generating" /> : "Generate Summary"}
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}
