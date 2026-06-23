"use client";

import { motion } from "framer-motion";
import { AlertTriangle, Building2, CalendarDays, Clock, MapPin, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { ChatWindow } from "@/components/ChatWindow";
import { HealthSelect } from "@/components/HealthSelect";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { VoiceOrb } from "@/components/VoiceOrb";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getPublicClinics } from "@/lib/api";
import type { PublicClinicResponse } from "@/types/api";

const chips = [
  { label: "Book an appointment", icon: CalendarDays },
  { label: "What are your hours?", icon: Clock },
  { label: "Do you accept new patients?", icon: UserPlus },
  { label: "I need to reschedule", icon: CalendarDays },
  { label: "I have severe chest pain", icon: AlertTriangle },
];

export default function ChatPage() {
  const [clinics, setClinics] = useState<PublicClinicResponse[]>([]);
  const [selectedClinicId, setSelectedClinicId] = useState("");
  const [loadingClinics, setLoadingClinics] = useState(true);
  const [clinicError, setClinicError] = useState("");

  useEffect(() => {
    let mounted = true;
    getPublicClinics()
      .then((items) => {
        if (!mounted) {
          return;
        }
        setClinics(items);
        if (items.length === 1) {
          setSelectedClinicId(items[0].clinic_id);
        } else if (typeof window !== "undefined") {
          const savedClinicId = window.localStorage.getItem("healthdesk_selected_clinic_id");
          if (savedClinicId && items.some((clinic) => clinic.clinic_id === savedClinicId)) {
            setSelectedClinicId(savedClinicId);
          }
        }
      })
      .catch(() => {
        if (mounted) {
          setClinicError("Unable to load clinic list. Please try again.");
        }
      })
      .finally(() => {
        if (mounted) {
          setLoadingClinics(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const selectedClinic = useMemo(
    () => clinics.find((clinic) => clinic.clinic_id === selectedClinicId),
    [clinics, selectedClinicId],
  );

  const selectClinic = (clinicId: string) => {
    setSelectedClinicId(clinicId);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("healthdesk_selected_clinic_id", clinicId);
    }
  };

  return (
    <main className="bg-[#F8FAFC]">
      <section className="hd-page">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-7"
        >
          <p className="text-sm font-bold uppercase tracking-[0.08em] text-[#0F766E]">
            Patient Assistant
          </p>
          <h1 className="mt-3 text-4xl font-bold text-[#0F172A]">
            Talk to HealthDesk AI
          </h1>
          <p className="mt-3 max-w-2xl text-[#64748B]">
            Choose the clinic first, then ask questions, view available
            appointment slots, and book directly through the assistant.
          </p>
        </motion.div>

        <section className="mb-6 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] sm:p-5">
          <div className="grid gap-4 lg:grid-cols-[1fr_minmax(280px,420px)] lg:items-center">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold text-[#0F172A]">
                <Building2 className="h-5 w-5 text-[#0F766E]" />
                Choose your clinic
              </h2>
              <p className="mt-1 text-sm text-[#64748B]">
                Bookings go directly into the staff dashboard for the clinic you select.
              </p>
            </div>
            <HealthSelect
              value={selectedClinicId}
              onValueChange={selectClinic}
              disabled={loadingClinics || clinics.length === 0}
              placeholder={loadingClinics ? "Loading clinics..." : "Select a clinic"}
              options={clinics.map((clinic) => {
                const isBookable =
                  (clinic.provider_count ?? 0) > 0 &&
                  (clinic.service_count ?? 0) > 0 &&
                  (clinic.available_slot_count ?? 0) > 0;
                return {
                  value: clinic.clinic_id,
                  label: `${clinic.name}${isBookable ? "" : " - needs setup"}`,
                };
              })}
              ariaLabel="Choose clinic for patient assistant"
            />
          </div>

          {loadingClinics ? (
            <div className="mt-5">
              <LoadingSpinner label="Loading clinics" />
            </div>
          ) : clinicError ? (
            <div className="mt-5 rounded-xl bg-[#FEF3C7] px-4 py-3 text-sm font-medium text-[#92400E]">
              {clinicError}
            </div>
          ) : selectedClinic ? (
            <div className="mt-4 rounded-2xl border border-[#CCFBF1] bg-[#F0FDFA] p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold text-[#0F172A]">{selectedClinic.name}</p>
                  {selectedClinic.address ? (
                    <p className="mt-1 flex items-start gap-2 text-sm text-[#64748B]">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#0F766E]" />
                      <span>{selectedClinic.address}</span>
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-semibold text-[#64748B]">
                  <span className="rounded-full bg-white px-2.5 py-1">
                    {selectedClinic.service_count ?? 0} services
                  </span>
                  <span className="rounded-full bg-white px-2.5 py-1">
                    {selectedClinic.provider_count ?? 0} providers
                  </span>
                  <span className="rounded-full bg-white px-2.5 py-1">
                    {selectedClinic.available_slot_count ?? 0} open slots
                  </span>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <Tabs defaultValue="chat">
          <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
            <TabsList className="mb-4 inline-flex min-w-max rounded-xl bg-white p-1 shadow-[0_1px_3px_rgba(0,0,0,0.06)] sm:mb-6">
              <TabsTrigger value="chat" className="px-5">
                Chat
              </TabsTrigger>
              <TabsTrigger value="voice" className="px-5">
                Voice Assistant
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="chat">
            {selectedClinic ? (
              <div>
                <ChatWindow
                  key={selectedClinic.clinic_id}
                  clinicId={selectedClinic.clinic_id}
                  clinicName={selectedClinic.name}
                  clinicTimezone={selectedClinic.timezone}
                  promptChips={chips}
                />
              </div>
            ) : (
              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-8 text-center text-[#64748B]">
                Select a clinic above to start the patient assistant.
              </div>
            )}
          </TabsContent>

          <TabsContent value="voice">
            <section className="mx-auto max-w-3xl rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
              <div className="mb-6 text-center">
                <h2 className="text-2xl font-bold text-[#0F172A]">
                  Voice Assistant
                </h2>
                <p className="mt-2 text-sm text-[#64748B]">
                  Speak naturally. HealthDesk AI will transcribe, answer, and
                  read safe responses aloud.
                </p>
              </div>
              {selectedClinic ? (
                <VoiceOrb clinicId={selectedClinic.clinic_id} />
              ) : (
                <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-6 text-center text-[#64748B]">
                  Select a clinic first so the voice assistant knows where to send requests.
                </div>
              )}
            </section>
          </TabsContent>
        </Tabs>
      </section>
    </main>
  );
}
