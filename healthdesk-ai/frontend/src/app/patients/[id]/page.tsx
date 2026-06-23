"use client";

import { motion } from "framer-motion";
import { Calendar, ClipboardList, MessageSquare, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/EmptyState";
import { HealthDatePicker } from "@/components/HealthDatePicker";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Modal } from "@/components/Modal";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePatientDetail } from "@/hooks/usePatients";
import type { PatientUpdatePayload } from "@/types/api";

function formatDate(value: string | null) {
  if (!value) {
    return "Not provided";
  }
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function QuickStat({
  icon: Icon,
  value,
  label,
}: {
  icon: LucideIcon;
  value: number;
  label: string;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-[#E2E8F0] bg-white px-4 py-2 text-sm shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <Icon className="h-4 w-4 text-[#0F766E]" />
      <span className="font-bold text-[#0F172A]">{value}</span>
      <span className="text-[#64748B]">{label}</span>
    </div>
  );
}

export default function PatientDetailPage() {
  const params = useParams<{ id: string }>();
  const { data, loading, error, update } = usePatientDetail(params.id);
  const [editOpen, setEditOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [draft, setDraft] = useState<PatientUpdatePayload>({});

  const openEdit = () => {
    if (!data) {
      return;
    }
    setDraft({
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email ?? "",
      phone: data.phone ?? "",
      date_of_birth: data.date_of_birth ?? "",
      new_patient: data.new_patient,
    });
    setEditOpen(true);
  };

  const submitEdit = async () => {
    setSubmitting(true);
    try {
      await update({
        ...draft,
        email: draft.email || null,
        phone: draft.phone || null,
        date_of_birth: draft.date_of_birth || null,
      });
      setEditOpen(false);
      toast.success("Patient updated");
    } catch {
      toast.error("Patient could not be updated");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ProtectedLayout>
      <main className="hd-page">
        {loading ? (
          <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-[#E2E8F0] bg-white">
            <LoadingSpinner label="Loading patient" />
          </div>
        ) : null}
        {error ? <div className="rounded-2xl border border-[#FEE2E2] bg-[#FEE2E2] p-4 text-[#991B1B]">{error}</div> : null}

        {data ? (
          <>
            <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-3xl font-bold text-[#0F172A]">{data.first_name} {data.last_name}</h1>
                    <StatusBadge status={data.new_patient ? "new" : "returning"} type="patient" />
                  </div>
                  <p className="mt-3 text-[#64748B]">{data.email ?? "No email"} • {data.phone ?? "No phone"}</p>
                  <p className="mt-1 text-sm text-[#94A3B8]">Date of birth: {formatDate(data.date_of_birth)}</p>
                </div>
                <Button type="button" className="rounded-xl bg-[#0F766E] text-white hover:bg-[#0D9488]" onClick={openEdit}>
                  Edit
                </Button>
              </div>
            </motion.section>

            <section className="mt-5 flex flex-wrap gap-3">
              <QuickStat icon={Calendar} value={data.appointments.length} label="Total Appointments" />
              <QuickStat
                icon={MessageSquare}
                value={data.conversations.filter((conversation) => conversation.status === "open").length}
                label="Open Conversations"
              />
              <QuickStat icon={ClipboardList} value={data.intake_forms.length} label="Intake Forms" />
            </section>

            <Tabs defaultValue="appointments" className="mt-8">
              <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
                <TabsList className="inline-flex min-w-max rounded-xl bg-white p-1 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                  <TabsTrigger value="appointments" className="px-4">Appointments</TabsTrigger>
                  <TabsTrigger value="conversations" className="px-4">Conversations</TabsTrigger>
                  <TabsTrigger value="intake" className="px-4">Intake Forms</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="appointments" className="mt-5">
                {data.appointments.length === 0 ? (
                  <EmptyState icon={Calendar} title="No appointments" message="Appointments for this patient will appear here." />
                ) : (
                  <div className="rounded-2xl border border-[#E2E8F0] bg-white p-2">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Service</TableHead>
                          <TableHead>Provider</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Reason</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.appointments.map((appointment) => (
                          <TableRow key={appointment.id}>
                            <TableCell>{appointment.service_name}</TableCell>
                            <TableCell>{appointment.provider_name}</TableCell>
                            <TableCell>{formatDateTime(appointment.start_time)}</TableCell>
                            <TableCell><StatusBadge status={appointment.status} type="appointment" /></TableCell>
                            <TableCell className="max-w-[260px] truncate text-[#64748B]">{appointment.reason ?? "No reason listed"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="conversations" className="mt-5">
                {data.conversations.length === 0 ? (
                  <EmptyState icon={MessageSquare} title="No conversations" message="Assistant and staff conversations for this patient will appear here." />
                ) : (
                  <div className="grid gap-4">
                    {data.conversations.map((conversation) => (
                      <div key={conversation.id} className="rounded-2xl border border-[#E2E8F0] bg-white p-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <div className="flex flex-wrap gap-2">
                              <StatusBadge status={conversation.channel} type="channel" />
                              <StatusBadge status={conversation.urgency} type="urgency" />
                            </div>
                            <p className="mt-3 font-semibold text-[#0F172A]">{conversation.category ?? "uncategorized"}</p>
                            <p className="text-sm text-[#64748B]">{conversation.message_count} messages • {formatDateTime(conversation.created_at)}</p>
                          </div>
                          <Button asChild variant="outline" className="rounded-xl border-[#0F766E] text-[#0F766E] hover:bg-[#F0FDFA]">
                            <Link href={`/conversations/${conversation.id}`}>View</Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="intake" className="mt-5">
                {data.intake_forms.length === 0 ? (
                  <EmptyState icon={ClipboardList} title="No intake forms" message="Structured intake captured by the assistant will appear here." />
                ) : (
                  <div className="grid gap-4">
                    {data.intake_forms.map((form) => (
                      <div key={form.id} className="rounded-2xl border border-[#E2E8F0] bg-white p-5">
                        <p className="font-semibold text-[#0F172A]">{form.reason_for_visit ?? "No reason captured"}</p>
                        <p className="mt-2 text-sm text-[#64748B]">Submitted {formatDateTime(form.created_at)}</p>
                        {form.ai_summary ? <p className="mt-3 rounded-2xl bg-[#F0FDFA] p-4 text-sm leading-6 text-[#1E293B]">{form.ai_summary}</p> : null}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <Modal open={editOpen} onOpenChange={setEditOpen} title="Edit Patient">
              <div className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input value={draft.first_name ?? ""} onChange={(event) => setDraft((current) => ({ ...current, first_name: event.target.value }))} className="h-11 rounded-xl border-[#CBD5E1] bg-[#F1F5F9]" />
                  <Input value={draft.last_name ?? ""} onChange={(event) => setDraft((current) => ({ ...current, last_name: event.target.value }))} className="h-11 rounded-xl border-[#CBD5E1] bg-[#F1F5F9]" />
                </div>
                <Input value={draft.email ?? ""} onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))} className="h-11 rounded-xl border-[#CBD5E1] bg-[#F1F5F9]" />
                <Input value={draft.phone ?? ""} onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))} className="h-11 rounded-xl border-[#CBD5E1] bg-[#F1F5F9]" />
                <HealthDatePicker
                  value={draft.date_of_birth ?? ""}
                  onValueChange={(value) => setDraft((current) => ({ ...current, date_of_birth: value }))}
                  placeholder="Date of birth"
                  ariaLabel="Select patient date of birth"
                />
                <label className="flex items-center gap-3 rounded-xl bg-[#F8FAFC] p-3 text-sm font-medium text-[#1E293B]">
                  <input type="checkbox" checked={Boolean(draft.new_patient)} onChange={(event) => setDraft((current) => ({ ...current, new_patient: event.target.checked }))} className="h-4 w-4 accent-[#0F766E]" />
                  New patient
                </label>
                <Button type="button" className="h-11 rounded-xl bg-[#0F766E] text-white hover:bg-[#0D9488]" disabled={submitting} onClick={() => void submitEdit()}>
                  {submitting ? <LoadingSpinner label="Saving" /> : "Save Patient"}
                </Button>
              </div>
            </Modal>
          </>
        ) : null}
      </main>
    </ProtectedLayout>
  );
}
