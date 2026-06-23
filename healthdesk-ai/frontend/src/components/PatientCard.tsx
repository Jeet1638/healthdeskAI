"use client";

import { motion } from "framer-motion";
import Link from "next/link";

import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import type { Patient } from "@/types/api";

export function PatientCard({ patient }: { patient: Patient }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)]"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-bold text-[#0F172A]">
              {patient.first_name} {patient.last_name}
            </h2>
            <StatusBadge status={patient.new_patient ? "new" : "returning"} type="patient" />
          </div>
          <p className="mt-2 text-sm text-[#64748B]">{patient.email || "No email"} • {patient.phone || "No phone"}</p>
          <p className="mt-1 text-xs text-[#94A3B8]">
            Created {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(patient.created_at))}
          </p>
        </div>
        <Button asChild className="rounded-xl bg-[#0F766E] text-white hover:bg-[#0D9488]">
          <Link href={`/patients/${patient.id}`}>View</Link>
        </Button>
      </div>
    </motion.article>
  );
}
