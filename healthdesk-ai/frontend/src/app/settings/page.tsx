"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, BriefcaseMedical, Building2, CalendarClock, CheckCircle2, Monitor, Moon, Plus, Stethoscope, Sun, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { HealthDatePicker } from "@/components/HealthDatePicker";
import { HealthSelect } from "@/components/HealthSelect";
import { HealthTimePicker } from "@/components/HealthTimePicker";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Modal } from "@/components/Modal";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { useTheme, type Theme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  createFaq,
  createAppointmentSlot,
  createProvider,
  createService,
  deleteFaq,
  deleteProvider,
  deleteService,
  getFaqs,
  getAppointmentSlots,
  getMyClinic,
  getProviders,
  getServices,
  updateFaq,
  updateMyClinic,
  updateProvider,
  updateService,
} from "@/lib/api";
import type {
  AppointmentSlot,
  ClinicResponse,
  ClinicUpdateRequest,
  FAQItem,
  FAQPayload,
  ProviderOption,
  ProviderPayload,
  ServiceOption,
  ServicePayload,
} from "@/types/api";

const days = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

type DayKey = (typeof days)[number];
type HoursDraft = Record<DayKey, { closed: boolean; open: string; close: string }>;

const defaultHours: HoursDraft = {
  monday: { closed: false, open: "8:00 AM", close: "5:00 PM" },
  tuesday: { closed: false, open: "8:00 AM", close: "5:00 PM" },
  wednesday: { closed: false, open: "8:00 AM", close: "5:00 PM" },
  thursday: { closed: false, open: "8:00 AM", close: "5:00 PM" },
  friday: { closed: false, open: "8:00 AM", close: "5:00 PM" },
  saturday: { closed: false, open: "9:00 AM", close: "1:00 PM" },
  sunday: { closed: true, open: "8:00 AM", close: "5:00 PM" },
};

const timezones = [
  "America/Phoenix",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "America/Denver",
  "UTC",
];

const emptyProvider: ProviderPayload = { name: "", specialty: "", email: "" };
const emptyService: ServicePayload = { name: "", description: "", duration_minutes: 30 };
const emptyFaq: FAQPayload = { question: "", answer: "", category: "", active: true };
const appearanceOptions: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

type SlotDraft = {
  provider_id: string;
  date: string;
  start_time: string;
  duration_minutes: number;
  count: number;
};

const defaultSlotDraft: SlotDraft = {
  provider_id: "",
  date: formatDateInput(new Date()),
  start_time: "09:00",
  duration_minutes: 30,
  count: 8,
};

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function parseHours(openingHours: Record<string, string>): HoursDraft {
  const draft = { ...defaultHours };
  for (const day of days) {
    const value = openingHours[day];
    if (!value) {
      continue;
    }
    if (value.toLowerCase() === "closed") {
      draft[day] = { ...draft[day], closed: true };
      continue;
    }
    const [open, close] = value.split("-");
    draft[day] = {
      closed: false,
      open: open?.trim() || draft[day].open,
      close: close?.trim() || draft[day].close,
    };
  }
  return draft;
}

function buildOpeningHours(hours: HoursDraft) {
  return days.reduce<Record<string, string>>((accumulator, day) => {
    accumulator[day] = hours[day].closed
      ? "closed"
      : `${hours[day].open.trim()}-${hours[day].close.trim()}`;
    return accumulator;
  }, {});
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatSlotTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

function clinicOffsetForDate(timezone: string | undefined) {
  const offsets: Record<string, string> = {
    "America/Phoenix": "-07:00",
    "America/Los_Angeles": "-07:00",
    "America/Denver": "-06:00",
    "America/Chicago": "-05:00",
    "America/New_York": "-04:00",
    UTC: "+00:00",
  };
  return offsets[timezone ?? "America/Phoenix"] ?? "-07:00";
}

function buildClinicDateTime(date: string, timeValue: string, timezone: string | undefined) {
  return new Date(`${date}T${timeValue}:00${clinicOffsetForDate(timezone)}`);
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [clinic, setClinic] = useState<ClinicResponse | null>(null);
  const [clinicDraft, setClinicDraft] = useState<ClinicUpdateRequest>({});
  const [hoursDraft, setHoursDraft] = useState<HoursDraft>(defaultHours);
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [appointmentSlots, setAppointmentSlots] = useState<AppointmentSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingClinic, setSavingClinic] = useState(false);
  const [savingSlots, setSavingSlots] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [providerModal, setProviderModal] = useState(false);
  const [serviceModal, setServiceModal] = useState(false);
  const [faqModal, setFaqModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ type: "provider" | "service" | "faq"; id: string; label: string } | null>(null);
  const [editingProvider, setEditingProvider] = useState<ProviderOption | null>(null);
  const [editingService, setEditingService] = useState<ServiceOption | null>(null);
  const [editingFaq, setEditingFaq] = useState<FAQItem | null>(null);
  const [providerDraft, setProviderDraft] = useState<ProviderPayload>(emptyProvider);
  const [serviceDraft, setServiceDraft] = useState<ServicePayload>(emptyService);
  const [faqDraft, setFaqDraft] = useState<FAQPayload>(emptyFaq);
  const [slotDraft, setSlotDraft] = useState<SlotDraft>(defaultSlotDraft);
  const [savedAction, setSavedAction] = useState("");

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const today = formatDateInput(new Date());
      const future = formatDateInput(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
      const [clinicData, providerData, serviceData, faqData, slotData] = await Promise.all([
        getMyClinic(),
        getProviders(),
        getServices(),
        getFaqs(),
        getAppointmentSlots({ date_from: today, date_to: future }),
      ]);
      setClinic(clinicData);
      setClinicDraft({
        name: clinicData.name,
        phone: clinicData.phone ?? "",
        email: clinicData.email ?? "",
        address: clinicData.address ?? "",
        timezone: clinicData.timezone,
        email_notifications_escalation: clinicData.email_notifications_escalation,
        email_notifications_appointments: clinicData.email_notifications_appointments,
      });
      setHoursDraft(parseHours(clinicData.opening_hours));
      setProviders(providerData);
      setServices(serviceData);
      setFaqs(faqData);
      setAppointmentSlots(slotData);
      setSlotDraft((current) => ({
        ...current,
        provider_id: current.provider_id || providerData.find((provider) => provider.active)?.id || "",
      }));
    } catch {
      toast.error("Settings could not be loaded");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSettings(), 0);
    return () => window.clearTimeout(timer);
  }, [loadSettings]);

  const markSaved = (action: string) => {
    setSavedAction(action);
    window.setTimeout(() => {
      setSavedAction((current) => (current === action ? "" : current));
    }, 2000);
  };

  const saveClinic = async () => {
    setSavingClinic(true);
    try {
      const updated = await updateMyClinic({
        ...clinicDraft,
        phone: clinicDraft.phone || undefined,
        email: clinicDraft.email || undefined,
        address: clinicDraft.address || undefined,
        opening_hours: buildOpeningHours(hoursDraft),
      });
      setClinic(updated);
      markSaved("clinic");
      toast.success("Clinic settings saved");
    } catch {
      toast.error("Clinic settings could not be saved");
    } finally {
      setSavingClinic(false);
    }
  };

  const refreshSlots = async () => {
    const today = formatDateInput(new Date());
    const future = formatDateInput(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
    setAppointmentSlots(await getAppointmentSlots({ date_from: today, date_to: future }));
  };

  const openAppointmentSlots = async () => {
    if (!slotDraft.provider_id) {
      toast.error("Choose a provider before opening slots");
      return;
    }
    if (!slotDraft.date || !slotDraft.start_time) {
      toast.error("Choose a date and start time");
      return;
    }
    if (slotDraft.duration_minutes < 10 || slotDraft.count < 1) {
      toast.error("Use a valid duration and slot count");
      return;
    }

    setSavingSlots(true);
    try {
      const start = buildClinicDateTime(slotDraft.date, slotDraft.start_time, clinic?.timezone);
      for (let index = 0; index < slotDraft.count; index += 1) {
        const slotStart = new Date(start.getTime() + index * slotDraft.duration_minutes * 60 * 1000);
        const slotEnd = new Date(slotStart.getTime() + slotDraft.duration_minutes * 60 * 1000);
        await createAppointmentSlot({
          provider_id: slotDraft.provider_id,
          start_time: slotStart.toISOString(),
          end_time: slotEnd.toISOString(),
        });
      }
      await refreshSlots();
      markSaved("slots");
      toast.success(`${slotDraft.count} appointment slots opened`);
    } catch {
      toast.error("Slots could not be opened. Check for duplicate times or try another start time.");
    } finally {
      setSavingSlots(false);
    }
  };

  const openProviderModal = (provider?: ProviderOption) => {
    setEditingProvider(provider ?? null);
    setProviderDraft(provider ? { name: provider.name, specialty: provider.specialty ?? "", email: provider.email ?? "" } : emptyProvider);
    setProviderModal(true);
  };

  const saveProvider = async () => {
    if (!providerDraft.name.trim()) {
      toast.error("Provider name is required");
      return;
    }
    setActionLoading(true);
    try {
      if (editingProvider) {
        await updateProvider(editingProvider.id, providerDraft);
      } else {
        await createProvider(providerDraft);
      }
      setProviders(await getProviders());
      markSaved("provider");
      window.setTimeout(() => setProviderModal(false), 2000);
      toast.success("Provider saved");
    } catch {
      toast.error("Provider could not be saved");
    } finally {
      setActionLoading(false);
    }
  };

  const openServiceModal = (service?: ServiceOption) => {
    setEditingService(service ?? null);
    setServiceDraft(service ? { name: service.name, description: service.description ?? "", duration_minutes: service.duration_minutes } : emptyService);
    setServiceModal(true);
  };

  const saveService = async () => {
    if (!serviceDraft.name.trim()) {
      toast.error("Service name is required");
      return;
    }
    setActionLoading(true);
    try {
      if (editingService) {
        await updateService(editingService.id, serviceDraft);
      } else {
        await createService(serviceDraft);
      }
      setServices(await getServices());
      markSaved("service");
      window.setTimeout(() => setServiceModal(false), 2000);
      toast.success("Service saved");
    } catch {
      toast.error("Service could not be saved");
    } finally {
      setActionLoading(false);
    }
  };

  const openFaqModal = (faq?: FAQItem) => {
    setEditingFaq(faq ?? null);
    setFaqDraft(faq ? { question: faq.question, answer: faq.answer, category: faq.category ?? "", active: faq.active } : emptyFaq);
    setFaqModal(true);
  };

  const saveFaq = async () => {
    if (!faqDraft.question?.trim() || !faqDraft.answer?.trim()) {
      toast.error("Question and answer are required");
      return;
    }
    setActionLoading(true);
    try {
      if (editingFaq) {
        await updateFaq(editingFaq.id, faqDraft);
      } else {
        await createFaq(faqDraft);
      }
      setFaqs(await getFaqs());
      markSaved("faq");
      window.setTimeout(() => setFaqModal(false), 2000);
      toast.success("FAQ saved");
    } catch {
      toast.error("FAQ could not be saved");
    } finally {
      setActionLoading(false);
    }
  };

  const toggleFaq = async (faq: FAQItem, active: boolean) => {
    setFaqs((current) => current.map((item) => (item.id === faq.id ? { ...item, active } : item)));
    try {
      await updateFaq(faq.id, { active });
      toast.success("FAQ updated");
    } catch {
      setFaqs(await getFaqs());
      toast.error("FAQ could not be updated");
    }
  };

  const confirmDelete = async () => {
    if (!deleteModal) {
      return;
    }
    setActionLoading(true);
    try {
      if (deleteModal.type === "provider") {
        await deleteProvider(deleteModal.id);
        setProviders(await getProviders());
      } else if (deleteModal.type === "service") {
        await deleteService(deleteModal.id);
        setServices(await getServices());
      } else {
        await deleteFaq(deleteModal.id);
        setFaqs(await getFaqs());
      }
      setDeleteModal(null);
      toast.success("Item updated");
    } catch {
      toast.error("Action could not be completed");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <ProtectedLayout>
      <main className="hd-page">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-sm font-bold uppercase tracking-[0.08em] text-[#0F766E]">Admin workspace</p>
          <h1 className="mt-2 text-3xl font-bold text-[#0F172A]">Settings</h1>
          <p className="mt-2 text-[#64748B]">Manage clinic profile, providers, services, and assistant FAQs.</p>
        </motion.div>

        {loading ? (
          <div className="mt-8 flex min-h-[320px] items-center justify-center rounded-2xl border border-[#E2E8F0] bg-white">
            <LoadingSpinner label="Loading settings" />
          </div>
        ) : (
          <Tabs defaultValue="clinic" className="mt-8">
            <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
              <TabsList className="inline-flex min-w-max rounded-xl bg-white p-1 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                <TabsTrigger value="clinic" className="px-4"><Building2 className="mr-2 h-4 w-4" />Clinic</TabsTrigger>
                <TabsTrigger value="providers" className="px-4"><Stethoscope className="mr-2 h-4 w-4" />Providers</TabsTrigger>
                <TabsTrigger value="services" className="px-4"><BriefcaseMedical className="mr-2 h-4 w-4" />Services</TabsTrigger>
                <TabsTrigger value="availability" className="px-4"><CalendarClock className="mr-2 h-4 w-4" />Availability</TabsTrigger>
                <TabsTrigger value="faqs" className="px-4"><BookOpen className="mr-2 h-4 w-4" />FAQs</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="clinic" className="mt-6">
              <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] sm:p-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <Input value={clinicDraft.name ?? ""} onChange={(event) => setClinicDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Clinic name" className="h-11 rounded-xl border-[#CBD5E1] bg-[#F1F5F9]" />
                  <Input value={clinicDraft.phone ?? ""} onChange={(event) => setClinicDraft((current) => ({ ...current, phone: event.target.value }))} placeholder="Phone" className="h-11 rounded-xl border-[#CBD5E1] bg-[#F1F5F9]" />
                  <Input value={clinicDraft.email ?? ""} onChange={(event) => setClinicDraft((current) => ({ ...current, email: event.target.value }))} placeholder="Email" className="h-11 rounded-xl border-[#CBD5E1] bg-[#F1F5F9]" />
                  <HealthSelect
                    value={clinicDraft.timezone ?? clinic?.timezone ?? "America/Phoenix"}
                    onValueChange={(value) => setClinicDraft((current) => ({ ...current, timezone: value }))}
                    options={timezones.map((timezone) => ({ value: timezone, label: timezone }))}
                    ariaLabel="Select clinic timezone"
                  />
                </div>
                <Textarea value={clinicDraft.address ?? ""} onChange={(event) => setClinicDraft((current) => ({ ...current, address: event.target.value }))} placeholder="Address" className="mt-4 min-h-24 rounded-xl border-[#CBD5E1] bg-[#F1F5F9]" />

                <div className="mt-6">
                  <h2 className="text-lg font-bold text-[#0F172A]">Opening hours</h2>
                  <div className="mt-4 grid gap-3">
                    {days.map((day) => (
                    <div key={day} className="grid gap-3 rounded-2xl border border-[#E2E8F0] p-4 md:grid-cols-[160px_120px_1fr] md:items-center">
                        <p className="font-bold text-[#0F172A]">{titleCase(day)}</p>
                        <label className="flex items-center gap-2 text-sm text-[#64748B]">
                          <Switch checked={hoursDraft[day].closed} onCheckedChange={(checked) => setHoursDraft((current) => ({ ...current, [day]: { ...current[day], closed: checked } }))} />
                          Closed
                        </label>
                        {hoursDraft[day].closed ? (
                          <p className="text-sm text-[#64748B]">Closed</p>
                        ) : (
                          <div className="grid gap-3 sm:grid-cols-2">
                            <Input value={hoursDraft[day].open} onChange={(event) => setHoursDraft((current) => ({ ...current, [day]: { ...current[day], open: event.target.value } }))} className="h-10 rounded-xl border-[#CBD5E1] bg-[#F1F5F9]" />
                            <Input value={hoursDraft[day].close} onChange={(event) => setHoursDraft((current) => ({ ...current, [day]: { ...current[day], close: event.target.value } }))} className="h-10 rounded-xl border-[#CBD5E1] bg-[#F1F5F9]" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-5">
                  <h2 className="text-lg font-bold text-[#0F172A]">Appearance</h2>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {appearanceOptions.map(({ value, label, icon: Icon }) => {
                      const selected = theme === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setTheme(value)}
                          className={`rounded-2xl border p-4 text-left transition-colors ${
                            selected
                              ? "border-[#0F766E] bg-[#F0FDFA] text-[#0F766E]"
                              : "border-[#E2E8F0] bg-white text-[#1E293B] hover:border-[#0F766E]"
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                          <span className="mt-3 block font-bold">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-5">
                  <h2 className="text-lg font-bold text-[#0F172A]">Email Notifications</h2>
                  <div className="mt-4 grid gap-3">
                    <div className="flex flex-col gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-bold text-[#0F172A]">Escalation Alerts</p>
                        <p className="text-sm text-[#64748B]">
                          Receive an email when a patient triggers an emergency escalation.
                        </p>
                      </div>
                      <Switch
                        checked={clinicDraft.email_notifications_escalation ?? true}
                        onCheckedChange={(checked) =>
                          setClinicDraft((current) => ({
                            ...current,
                            email_notifications_escalation: checked,
                          }))
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-bold text-[#0F172A]">Appointment Confirmations</p>
                        <p className="text-sm text-[#64748B]">
                          Send patients a confirmation email when they book an appointment.
                        </p>
                      </div>
                      <Switch
                        checked={clinicDraft.email_notifications_appointments ?? true}
                        onCheckedChange={(checked) =>
                          setClinicDraft((current) => ({
                            ...current,
                            email_notifications_appointments: checked,
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-6 w-full sm:max-w-40">
                  <SaveButton
                    loading={savingClinic}
                    saved={savedAction === "clinic"}
                    label="Save Clinic"
                    onClick={saveClinic}
                  />
                </div>
              </section>
            </TabsContent>

            <TabsContent value="providers" className="mt-6">
              <CrudSection title="Providers" onAdd={() => openProviderModal()} addLabel="Add Provider">
                {providers.map((provider) => (
                  <div key={provider.id} className="grid gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-center">
                    <p className="font-bold text-[#0F172A]">{provider.name}</p>
                    <p className="text-sm text-[#64748B]">{provider.specialty ?? "No specialty"}</p>
                    <p className="text-sm text-[#64748B]">{provider.email ?? "No email"}</p>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-[#F1F5F9] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#64748B]">{provider.active ? "active" : "inactive"}</span>
                      <Button type="button" variant="outline" className="rounded-xl" onClick={() => openProviderModal(provider)}>Edit</Button>
                      <Button type="button" variant="outline" className="rounded-xl border-[#FEE2E2] text-[#EF4444]" disabled={!provider.active} onClick={() => setDeleteModal({ type: "provider", id: provider.id, label: provider.name })}>Deactivate</Button>
                    </div>
                  </div>
                ))}
              </CrudSection>
            </TabsContent>

            <TabsContent value="services" className="mt-6">
              <CrudSection title="Services" onAdd={() => openServiceModal()} addLabel="Add Service">
                {services.map((service) => (
                  <div key={service.id} className="grid gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 md:grid-cols-[1fr_1fr_120px_auto] md:items-center">
                    <p className="font-bold text-[#0F172A]">{service.name}</p>
                    <p className="text-sm text-[#64748B]">{service.description ?? "No description"}</p>
                    <p className="text-sm text-[#64748B]">{service.duration_minutes} min</p>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-[#F1F5F9] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#64748B]">{service.active ? "active" : "inactive"}</span>
                      <Button type="button" variant="outline" className="rounded-xl" onClick={() => openServiceModal(service)}>Edit</Button>
                      <Button type="button" variant="outline" className="rounded-xl border-[#FEE2E2] text-[#EF4444]" disabled={!service.active} onClick={() => setDeleteModal({ type: "service", id: service.id, label: service.name })}>Deactivate</Button>
                    </div>
                  </div>
                ))}
              </CrudSection>
            </TabsContent>

            <TabsContent value="availability" className="mt-6">
              <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                <div className="mb-5 flex flex-col gap-2">
                  <h2 className="text-xl font-bold text-[#0F172A]">Open Appointment Slots</h2>
                  <p className="text-sm leading-6 text-[#64748B]">
                    Create bookable times for the patient assistant. Patients can only book slots opened here.
                  </p>
                </div>

                <div className="grid gap-4 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_auto] lg:items-end">
                  <div className="grid gap-2">
                    <label className="text-sm font-semibold text-[#0F172A]">Provider</label>
                    <HealthSelect
                      value={slotDraft.provider_id}
                      onValueChange={(value) => setSlotDraft((current) => ({ ...current, provider_id: value }))}
                      options={[
                        { value: "", label: "Choose provider" },
                        ...providers
                          .filter((provider) => provider.active)
                          .map((provider) => ({ value: provider.id, label: provider.name })),
                      ]}
                      ariaLabel="Choose provider for open slots"
                      buttonClassName="bg-white"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-semibold text-[#0F172A]">Date</label>
                    <HealthDatePicker
                      value={slotDraft.date}
                      onValueChange={(value) => setSlotDraft((current) => ({ ...current, date: value }))}
                      placeholder="Choose date"
                      ariaLabel="Choose date for open slots"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-semibold text-[#0F172A]">Start</label>
                    <HealthTimePicker
                      value={slotDraft.start_time}
                      onValueChange={(value) => setSlotDraft((current) => ({ ...current, start_time: value }))}
                      ariaLabel="Choose start time for open slots"
                      stepMinutes={10}
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-semibold text-[#0F172A]">Minutes</label>
                    <Input
                      type="number"
                      min={10}
                      max={180}
                      value={slotDraft.duration_minutes}
                      onChange={(event) => setSlotDraft((current) => ({ ...current, duration_minutes: Number(event.target.value) }))}
                      className="h-11 rounded-xl border-[#CBD5E1] bg-white"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-semibold text-[#0F172A]">Slots</label>
                    <Input
                      type="number"
                      min={1}
                      max={24}
                      value={slotDraft.count}
                      onChange={(event) => setSlotDraft((current) => ({ ...current, count: Number(event.target.value) }))}
                      className="h-11 rounded-xl border-[#CBD5E1] bg-white"
                    />
                  </div>
                  <SaveButton
                    loading={savingSlots}
                    saved={savedAction === "slots"}
                    label="Open Slots"
                    onClick={openAppointmentSlots}
                  />
                </div>

                <div className="mt-6">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-bold text-[#0F172A]">Upcoming Open Slots</h3>
                    <Button type="button" variant="outline" className="rounded-xl" onClick={() => void refreshSlots()}>
                      Refresh
                    </Button>
                  </div>
                  <div className="mt-4 grid gap-3">
                    {appointmentSlots.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-white p-6 text-center text-sm text-[#64748B]">
                        No open slots yet. Add providers, then open slots above.
                      </div>
                    ) : (
                      appointmentSlots.slice(0, 24).map((slot) => (
                        <div key={slot.id} className="grid gap-2 rounded-2xl border border-[#E2E8F0] bg-white p-4 md:grid-cols-[1fr_1fr_auto] md:items-center">
                          <div>
                            <p className="font-bold text-[#0F172A]">{formatSlotTime(slot.start_time)}</p>
                            <p className="text-sm text-[#64748B]">Ends {formatSlotTime(slot.end_time)}</p>
                          </div>
                          <p className="text-sm font-medium text-[#64748B]">{slot.provider_name}</p>
                          <span className="w-fit rounded-full bg-[#D1FAE5] px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-[#065F46]">
                            Open
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </section>
            </TabsContent>

            <TabsContent value="faqs" className="mt-6">
              <CrudSection title="FAQs" onAdd={() => openFaqModal()} addLabel="Add FAQ">
                {faqs.map((faq) => (
                  <div key={faq.id} className="grid gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 md:grid-cols-[1fr_180px_100px_auto] md:items-center">
                    <p className="font-bold text-[#0F172A]">{faq.question.length > 90 ? `${faq.question.slice(0, 90)}...` : faq.question}</p>
                    <p className="text-sm text-[#64748B]">{faq.category ?? "uncategorized"}</p>
                    <Switch checked={faq.active} onCheckedChange={(checked) => void toggleFaq(faq, checked)} />
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" className="rounded-xl" onClick={() => openFaqModal(faq)}>Edit</Button>
                      <Button type="button" variant="outline" className="rounded-xl border-[#FEE2E2] text-[#EF4444]" onClick={() => setDeleteModal({ type: "faq", id: faq.id, label: faq.question })}>
                        <Trash2 className="mr-1 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </CrudSection>
            </TabsContent>
          </Tabs>
        )}

        <Modal open={providerModal} onOpenChange={setProviderModal} title={editingProvider ? "Edit Provider" : "Add Provider"}>
          <EntityEditor>
            <Input value={providerDraft.name} onChange={(event) => setProviderDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Name" className="h-11 rounded-xl border-[#CBD5E1] bg-[#F1F5F9]" />
            <Input value={providerDraft.specialty ?? ""} onChange={(event) => setProviderDraft((current) => ({ ...current, specialty: event.target.value }))} placeholder="Specialty" className="h-11 rounded-xl border-[#CBD5E1] bg-[#F1F5F9]" />
            <Input value={providerDraft.email ?? ""} onChange={(event) => setProviderDraft((current) => ({ ...current, email: event.target.value }))} placeholder="Email" className="h-11 rounded-xl border-[#CBD5E1] bg-[#F1F5F9]" />
            <SaveButton loading={actionLoading} saved={savedAction === "provider"} onClick={saveProvider} />
          </EntityEditor>
        </Modal>

        <Modal open={serviceModal} onOpenChange={setServiceModal} title={editingService ? "Edit Service" : "Add Service"}>
          <EntityEditor>
            <Input value={serviceDraft.name} onChange={(event) => setServiceDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Name" className="h-11 rounded-xl border-[#CBD5E1] bg-[#F1F5F9]" />
            <Textarea value={serviceDraft.description ?? ""} onChange={(event) => setServiceDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Description" className="min-h-24 rounded-xl border-[#CBD5E1] bg-[#F1F5F9]" />
            <Input type="number" value={serviceDraft.duration_minutes} onChange={(event) => setServiceDraft((current) => ({ ...current, duration_minutes: Number(event.target.value) }))} className="h-11 rounded-xl border-[#CBD5E1] bg-[#F1F5F9]" />
            <SaveButton loading={actionLoading} saved={savedAction === "service"} onClick={saveService} />
          </EntityEditor>
        </Modal>

        <Modal open={faqModal} onOpenChange={setFaqModal} title={editingFaq ? "Edit FAQ" : "Add FAQ"}>
          <EntityEditor>
            <Textarea value={faqDraft.question ?? ""} onChange={(event) => setFaqDraft((current) => ({ ...current, question: event.target.value }))} placeholder="Question" className="min-h-24 rounded-xl border-[#CBD5E1] bg-[#F1F5F9]" />
            <Textarea value={faqDraft.answer ?? ""} onChange={(event) => setFaqDraft((current) => ({ ...current, answer: event.target.value }))} placeholder="Answer" className="min-h-28 rounded-xl border-[#CBD5E1] bg-[#F1F5F9]" />
            <Input value={faqDraft.category ?? ""} onChange={(event) => setFaqDraft((current) => ({ ...current, category: event.target.value }))} placeholder="Category" className="h-11 rounded-xl border-[#CBD5E1] bg-[#F1F5F9]" />
            <SaveButton loading={actionLoading} saved={savedAction === "faq"} onClick={saveFaq} />
          </EntityEditor>
        </Modal>

        <Modal open={Boolean(deleteModal)} onOpenChange={(open) => !open && setDeleteModal(null)} title="Confirm action">
          <div className="grid gap-4">
            <p className="text-sm text-[#64748B]">Are you sure you want to update {deleteModal?.label}?</p>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => setDeleteModal(null)}>Cancel</Button>
              <Button type="button" className="rounded-xl bg-[#EF4444] text-white hover:bg-[#DC2626]" disabled={actionLoading} onClick={() => void confirmDelete()}>
                {actionLoading ? <LoadingSpinner label="Saving" /> : "Confirm"}
              </Button>
            </div>
          </div>
        </Modal>
      </main>
    </ProtectedLayout>
  );
}

function CrudSection({
  title,
  addLabel,
  onAdd,
  children,
}: {
  title: string;
  addLabel: string;
  onAdd: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold text-[#0F172A]">{title}</h2>
        <Button type="button" className="rounded-xl bg-[#0F766E] text-white hover:bg-[#0D9488]" onClick={onAdd}>
          <Plus className="mr-2 h-4 w-4" />
          {addLabel}
        </Button>
      </div>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

function EntityEditor({ children }: { children: ReactNode }) {
  return <div className="grid gap-4">{children}</div>;
}

function SaveButton({
  loading,
  saved,
  label = "Save",
  onClick,
}: {
  loading: boolean;
  saved?: boolean;
  label?: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      className={`h-11 w-full rounded-xl text-white ${saved ? "bg-[#10B981] hover:bg-[#10B981]" : "bg-[#0F766E] hover:bg-[#0D9488]"}`}
      disabled={loading || saved}
      onClick={() => void onClick()}
    >
      <AnimatePresence mode="wait" initial={false}>
        {loading ? (
          <motion.span key="loading" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
            <LoadingSpinner label="Saving" />
          </motion.span>
        ) : saved ? (
          <motion.span key="saved" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="inline-flex items-center">
            <CheckCircle2 className="mr-2 h-4 w-4 text-white" />
            Saved!
          </motion.span>
        ) : (
          <motion.span key="save" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </Button>
  );
}
