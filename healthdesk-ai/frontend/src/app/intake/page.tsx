"use client";

import { motion } from "framer-motion";
import { ClipboardList } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/EmptyState";
import { HealthDatePicker } from "@/components/HealthDatePicker";
import { HealthSelect } from "@/components/HealthSelect";
import { IntakeCard } from "@/components/IntakeCard";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { SkeletonRows } from "@/components/Skeleton";
import { useIntakeForms } from "@/hooks/useIntakeForms";
import type { ConversationUrgency, IntakeForm } from "@/types/api";

export default function IntakePage() {
  const [urgency, setUrgency] = useState<ConversationUrgency | "all">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [generatingId, setGeneratingId] = useState("");
  const filters = useMemo(
    () => ({
      urgency,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    }),
    [dateFrom, dateTo, urgency],
  );
  const { data, loading, error, generateSummary } = useIntakeForms(filters);

  const onGenerateSummary = async (intake: IntakeForm) => {
    if (!intake.conversation_id) {
      toast.error("No conversation is linked to this intake form");
      return;
    }
    setGeneratingId(intake.id);
    try {
      await generateSummary(intake.conversation_id);
      toast.success("Intake summary generated");
    } catch {
      toast.error("Intake summary could not be generated");
    } finally {
      setGeneratingId("");
    }
  };

  return (
    <ProtectedLayout>
      <main className="hd-page">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-sm font-bold uppercase tracking-[0.08em] text-[#0F766E]">Intake review</p>
          <h1 className="mt-2 text-3xl font-bold text-[#0F172A]">Intake Forms</h1>
          <p className="mt-2 text-[#64748B]">Review structured intake details collected by the assistant.</p>
        </motion.div>

        <section className="mt-8 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <div className="grid gap-3 md:grid-cols-3">
            <HealthSelect
              value={urgency}
              onValueChange={(value) => setUrgency(value as ConversationUrgency | "all")}
              options={[
                { value: "all", label: "All urgency" },
                { value: "low", label: "Low" },
                { value: "medium", label: "Medium" },
                { value: "high", label: "High" },
                { value: "emergency", label: "Emergency" },
              ]}
              ariaLabel="Filter intake forms by urgency"
            />
            <HealthDatePicker
              value={dateFrom}
              onValueChange={setDateFrom}
              placeholder="Start date"
              ariaLabel="Filter intake forms from date"
            />
            <HealthDatePicker
              value={dateTo}
              onValueChange={setDateTo}
              placeholder="End date"
              ariaLabel="Filter intake forms to date"
            />
          </div>
        </section>

        {error ? <div className="mt-6 rounded-2xl border border-[#FEE2E2] bg-[#FEE2E2] p-4 text-[#991B1B]">{error}</div> : null}

        <section className="mt-6 grid gap-4">
          {loading ? <SkeletonRows rows={5} /> : null}
          {!loading && data.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No intake forms" message="Structured intake collected by the assistant will appear here." />
          ) : null}
          {!loading ? data.map((intake) => (
            <IntakeCard
              key={intake.id}
              intake={intake}
              generating={generatingId === intake.id}
              onGenerateSummary={(item) => void onGenerateSummary(item)}
            />
          )) : null}
        </section>
      </main>
    </ProtectedLayout>
  );
}
