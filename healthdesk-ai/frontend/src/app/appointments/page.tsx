"use client";

import { motion } from "framer-motion";
import { CalendarPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppointmentTable } from "@/components/AppointmentTable";
import { HealthDatePicker } from "@/components/HealthDatePicker";
import { HealthSelect } from "@/components/HealthSelect";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Modal } from "@/components/Modal";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAppointments } from "@/hooks/useAppointments";
import { usePatients } from "@/hooks/usePatients";
import { getMyClinic } from "@/lib/api";
import type { Appointment, AppointmentCreatePayload, AppointmentStatus } from "@/types/api";

function formatSlot(start: string, end: string, timeZone: string) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return `${new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(startDate)} - ${new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(endDate)}`;
}

const emptyNewAppointment: AppointmentCreatePayload = {
  patient_id: "",
  provider_id: "",
  service_id: "",
  slot_id: "",
  reason: "",
  notes: "",
};

export default function AppointmentsPage() {
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | "all">("all");
  const [providerFilter, setProviderFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [newAppointment, setNewAppointment] = useState<AppointmentCreatePayload>(emptyNewAppointment);
  const [newPatientSearch, setNewPatientSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [rescheduleSlotId, setRescheduleSlotId] = useState("");
  const [clinicTimeZone, setClinicTimeZone] = useState("America/Phoenix");

  const appointmentFilters = useMemo(
    () => ({
      status: statusFilter,
      provider_id: providerFilter || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    }),
    [dateFrom, dateTo, providerFilter, statusFilter],
  );
  const patientFilters = useMemo(
    () => ({ search: newPatientSearch || undefined, page_size: 100 }),
    [newPatientSearch],
  );

  const {
    data,
    providers,
    services,
    slots,
    loading,
    slotsLoading,
    error,
    fetchSlots,
    create,
    reschedule,
    cancel,
  } = useAppointments(appointmentFilters);
  const { data: patients } = usePatients(patientFilters);

  useEffect(() => {
    let mounted = true;
    getMyClinic()
      .then((clinic) => {
        if (mounted) {
          setClinicTimeZone(clinic.timezone || "America/Phoenix");
        }
      })
      .catch(() => {
        if (mounted) {
          setClinicTimeZone("America/Phoenix");
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (newOpen && newAppointment.provider_id) {
      void fetchSlots({
        provider_id: newAppointment.provider_id,
        service_id: newAppointment.service_id || undefined,
      });
    }
  }, [fetchSlots, newAppointment.provider_id, newAppointment.service_id, newOpen]);

  const openReschedule = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setRescheduleSlotId("");
    setRescheduleOpen(true);
    void fetchSlots({ provider_id: appointment.provider_id, service_id: appointment.service_id });
  };

  const openCancel = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setCancelOpen(true);
  };

  const submitNewAppointment = async () => {
    if (!newAppointment.patient_id || !newAppointment.provider_id || !newAppointment.service_id || !newAppointment.slot_id) {
      toast.error("Select patient, provider, service, and slot first");
      return;
    }
    setSubmitting(true);
    try {
      await create(newAppointment);
      setNewOpen(false);
      setNewAppointment(emptyNewAppointment);
      toast.success("Appointment created");
    } catch {
      toast.error("Appointment could not be created");
    } finally {
      setSubmitting(false);
    }
  };

  const submitReschedule = async () => {
    if (!selectedAppointment || !rescheduleSlotId) {
      toast.error("Select a new slot first");
      return;
    }
    setSubmitting(true);
    try {
      await reschedule(selectedAppointment.id, rescheduleSlotId);
      setRescheduleOpen(false);
      setSelectedAppointment(null);
      toast.success("Appointment rescheduled");
    } catch {
      toast.error("Appointment could not be rescheduled");
    } finally {
      setSubmitting(false);
    }
  };

  const submitCancel = async () => {
    if (!selectedAppointment) {
      return;
    }
    setSubmitting(true);
    try {
      await cancel(selectedAppointment.id);
      setCancelOpen(false);
      setSelectedAppointment(null);
      toast.success("Appointment cancelled");
    } catch {
      toast.error("Appointment could not be cancelled");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ProtectedLayout>
      <main className="hd-page">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.08em] text-[#0F766E]">Booking operations</p>
            <h1 className="mt-2 text-3xl font-bold text-[#0F172A]">Appointments</h1>
            <p className="mt-2 text-[#64748B]">Coordinate upcoming visits and booking requests.</p>
          </div>
          <Button type="button" className="rounded-xl bg-[#0F766E] text-white hover:bg-[#0D9488]" onClick={() => setNewOpen(true)}>
            <CalendarPlus className="mr-2 h-4 w-4" />
            New Appointment
          </Button>
        </motion.div>

        <section className="mt-8 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <div className="grid gap-3 md:grid-cols-4">
            <HealthDatePicker
              value={dateFrom}
              onValueChange={setDateFrom}
              placeholder="Start date"
              ariaLabel="Filter appointments from date"
            />
            <HealthDatePicker
              value={dateTo}
              onValueChange={setDateTo}
              placeholder="End date"
              ariaLabel="Filter appointments to date"
            />
            <HealthSelect
              value={providerFilter}
              onValueChange={setProviderFilter}
              options={[
                { value: "", label: "All providers" },
                ...providers.map((provider) => ({ value: provider.id, label: provider.name })),
              ]}
              ariaLabel="Filter by provider"
            />
            <HealthSelect
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as AppointmentStatus | "all")}
              options={[
                { value: "all", label: "All status" },
                { value: "scheduled", label: "Scheduled" },
                { value: "rescheduled", label: "Rescheduled" },
                { value: "cancelled", label: "Cancelled" },
                { value: "completed", label: "Completed" },
                { value: "no_show", label: "No show" },
              ]}
              ariaLabel="Filter by appointment status"
            />
          </div>
        </section>

        {error ? <div className="mt-6 rounded-2xl border border-[#FEE2E2] bg-[#FEE2E2] p-4 text-[#991B1B]">{error}</div> : null}

        <section className="mt-6">
          <AppointmentTable appointments={data} loading={loading} onReschedule={openReschedule} onCancel={openCancel} timeZone={clinicTimeZone} />
        </section>

        <Modal open={newOpen} onOpenChange={setNewOpen} title="New Appointment" description="Create a visit from real patient, provider, service, and slot records.">
          <div className="grid gap-5">
            <div>
              <p className="mb-2 text-sm font-bold text-[#0F172A]">Step 1: Select or search patient</p>
              <Input value={newPatientSearch} onChange={(event) => setNewPatientSearch(event.target.value)} placeholder="Search patient name or email" className="mb-3 h-11 rounded-xl border-[#CBD5E1] bg-[#F1F5F9]" />
              <HealthSelect
                value={newAppointment.patient_id}
                onValueChange={(value) => setNewAppointment((current) => ({ ...current, patient_id: value }))}
                options={[
                  { value: "", label: "Select patient" },
                  ...patients.items.map((patient) => ({
                    value: patient.id,
                    label: `${patient.first_name} ${patient.last_name}${patient.email ? ` (${patient.email})` : ""}`,
                  })),
                ]}
                ariaLabel="Select patient"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-bold text-[#0F172A]">Step 2: Select provider</p>
                <HealthSelect
                  value={newAppointment.provider_id}
                  onValueChange={(value) => setNewAppointment((current) => ({ ...current, provider_id: value, slot_id: "" }))}
                  options={[
                    { value: "", label: "Select provider" },
                    ...providers.map((provider) => ({ value: provider.id, label: provider.name })),
                  ]}
                  ariaLabel="Select provider"
                />
              </div>
              <div>
                <p className="mb-2 text-sm font-bold text-[#0F172A]">Step 3: Select service</p>
                <HealthSelect
                  value={newAppointment.service_id}
                  onValueChange={(value) => setNewAppointment((current) => ({ ...current, service_id: value, slot_id: "" }))}
                  options={[
                    { value: "", label: "Select service" },
                    ...services.map((service) => ({ value: service.id, label: `${service.name} (${service.duration_minutes} min)` })),
                  ]}
                  ariaLabel="Select service"
                />
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-bold text-[#0F172A]">Step 4: Select available slot</p>
              <HealthSelect
                value={newAppointment.slot_id}
                onValueChange={(value) => setNewAppointment((current) => ({ ...current, slot_id: value }))}
                disabled={!newAppointment.provider_id || slotsLoading}
                options={[
                  { value: "", label: slotsLoading ? "Loading slots..." : "Select slot" },
                  ...slots.map((slot) => ({ value: slot.id, label: formatSlot(slot.start_time, slot.end_time, clinicTimeZone) })),
                ]}
                ariaLabel="Select available slot"
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-bold text-[#0F172A]">Step 5: Reason</p>
              <Textarea value={newAppointment.reason ?? ""} onChange={(event) => setNewAppointment((current) => ({ ...current, reason: event.target.value }))} placeholder="Reason for visit" className="min-h-24 rounded-xl border-[#CBD5E1] bg-[#F1F5F9]" />
            </div>

            <Button type="button" className="h-11 rounded-xl bg-[#0F766E] text-white hover:bg-[#0D9488]" disabled={submitting} onClick={() => void submitNewAppointment()}>
              {submitting ? <LoadingSpinner label="Creating" /> : "Create Appointment"}
            </Button>
          </div>
        </Modal>

        <Modal open={rescheduleOpen} onOpenChange={setRescheduleOpen} title="Reschedule Appointment">
          <div className="grid gap-4">
            <p className="text-sm text-[#64748B]">Choose a new available slot for {selectedAppointment?.patient_name}.</p>
            <HealthSelect
              value={rescheduleSlotId}
              onValueChange={setRescheduleSlotId}
              disabled={slotsLoading}
              options={[
                { value: "", label: slotsLoading ? "Loading slots..." : "Select new slot" },
                ...slots.map((slot) => ({ value: slot.id, label: formatSlot(slot.start_time, slot.end_time, clinicTimeZone) })),
              ]}
              ariaLabel="Select new appointment slot"
            />
            <Button type="button" className="h-11 rounded-xl bg-[#0F766E] text-white hover:bg-[#0D9488]" disabled={submitting || !rescheduleSlotId} onClick={() => void submitReschedule()}>
              {submitting ? <LoadingSpinner label="Saving" /> : "Confirm Reschedule"}
            </Button>
          </div>
        </Modal>

        <Modal open={cancelOpen} onOpenChange={setCancelOpen} title="Cancel Appointment">
          <div className="grid gap-4">
            <p className="text-sm text-[#64748B]">Are you sure you want to cancel this appointment for {selectedAppointment?.patient_name}?</p>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => setCancelOpen(false)}>Keep Appointment</Button>
              <Button type="button" className="rounded-xl bg-[#EF4444] text-white hover:bg-[#DC2626]" disabled={submitting} onClick={() => void submitCancel()}>
                {submitting ? <LoadingSpinner label="Cancelling" /> : "Cancel Appointment"}
              </Button>
            </div>
          </div>
        </Modal>
      </main>
    </ProtectedLayout>
  );
}
