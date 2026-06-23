"use client";

import { motion } from "framer-motion";
import { Search, UserPlus, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/EmptyState";
import { HealthDatePicker } from "@/components/HealthDatePicker";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Modal } from "@/components/Modal";
import { PatientCard } from "@/components/PatientCard";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { SkeletonRows } from "@/components/Skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePatients } from "@/hooks/usePatients";
import type { PatientCreatePayload } from "@/types/api";

const emptyPatient: PatientCreatePayload = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  date_of_birth: "",
  new_patient: true,
};

export default function PatientsPage() {
  const [search, setSearch] = useState("");
  const [newOnly, setNewOnly] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [patient, setPatient] = useState<PatientCreatePayload>(emptyPatient);
  const [submitting, setSubmitting] = useState(false);
  const filters = useMemo(
    () => ({ search: search || undefined, new_patient: newOnly ? true : undefined, page_size: 100 }),
    [newOnly, search],
  );
  const { data, loading, error, create } = usePatients(filters);

  const submitPatient = async () => {
    if (!patient.first_name.trim() || !patient.last_name.trim()) {
      toast.error("First and last name are required");
      return;
    }
    setSubmitting(true);
    try {
      await create({
        ...patient,
        email: patient.email || null,
        phone: patient.phone || null,
        date_of_birth: patient.date_of_birth || null,
      });
      setModalOpen(false);
      setPatient(emptyPatient);
      toast.success("Patient added");
    } catch {
      toast.error("Patient could not be added");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ProtectedLayout>
      <main className="hd-page">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.08em] text-[#0F766E]">Patient directory</p>
            <h1 className="mt-2 text-3xl font-bold text-[#0F172A]">Patients</h1>
            <p className="mt-2 text-[#64748B]">Keep patient context close to every front-desk workflow.</p>
          </div>
          <Button type="button" className="rounded-xl bg-[#0F766E] text-white hover:bg-[#0D9488]" onClick={() => setModalOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add Patient
          </Button>
        </motion.div>

        <section className="mt-8 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
            <label className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or email" className="h-11 rounded-xl border-[#CBD5E1] bg-[#F1F5F9] pl-10" />
            </label>
            <label className="flex h-11 items-center gap-3 rounded-xl border border-[#CBD5E1] bg-[#F1F5F9] px-4 text-sm font-medium text-[#1E293B]">
              <input type="checkbox" checked={newOnly} onChange={(event) => setNewOnly(event.target.checked)} className="h-4 w-4 accent-[#0F766E]" />
              New patients only
            </label>
          </div>
        </section>

        {error ? <div className="mt-6 rounded-2xl border border-[#FEE2E2] bg-[#FEE2E2] p-4 text-[#991B1B]">{error}</div> : null}

        <section className="mt-6 grid gap-4">
          {loading ? <SkeletonRows rows={6} /> : null}
          {!loading && data.items.length === 0 ? (
            <EmptyState icon={Users} title="No patients found" message="Add a patient or adjust your filters to expand the directory." />
          ) : null}
          {!loading ? data.items.map((item) => <PatientCard key={item.id} patient={item} />) : null}
        </section>

        <Modal open={modalOpen} onOpenChange={setModalOpen} title="Add Patient" description="Create a patient record for the current clinic.">
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input value={patient.first_name} onChange={(event) => setPatient((current) => ({ ...current, first_name: event.target.value }))} placeholder="First name" className="h-11 rounded-xl border-[#CBD5E1] bg-[#F1F5F9]" />
              <Input value={patient.last_name} onChange={(event) => setPatient((current) => ({ ...current, last_name: event.target.value }))} placeholder="Last name" className="h-11 rounded-xl border-[#CBD5E1] bg-[#F1F5F9]" />
            </div>
            <Input value={patient.email ?? ""} onChange={(event) => setPatient((current) => ({ ...current, email: event.target.value }))} placeholder="Email" className="h-11 rounded-xl border-[#CBD5E1] bg-[#F1F5F9]" />
            <Input value={patient.phone ?? ""} onChange={(event) => setPatient((current) => ({ ...current, phone: event.target.value }))} placeholder="Phone" className="h-11 rounded-xl border-[#CBD5E1] bg-[#F1F5F9]" />
            <HealthDatePicker
              value={patient.date_of_birth ?? ""}
              onValueChange={(value) => setPatient((current) => ({ ...current, date_of_birth: value }))}
              placeholder="Date of birth"
              ariaLabel="Select patient date of birth"
            />
            <label className="flex items-center gap-3 rounded-xl bg-[#F8FAFC] p-3 text-sm font-medium text-[#1E293B]">
              <input type="checkbox" checked={patient.new_patient} onChange={(event) => setPatient((current) => ({ ...current, new_patient: event.target.checked }))} className="h-4 w-4 accent-[#0F766E]" />
              Mark as new patient
            </label>
            <Button type="button" className="h-11 rounded-xl bg-[#0F766E] text-white hover:bg-[#0D9488]" disabled={submitting} onClick={() => void submitPatient()}>
              {submitting ? <LoadingSpinner label="Adding" /> : "Add Patient"}
            </Button>
          </div>
        </Modal>
      </main>
    </ProtectedLayout>
  );
}
