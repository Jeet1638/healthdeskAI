"use client";

import { motion } from "framer-motion";
import { AlertTriangle, CalendarDays, Mail, SendHorizonal, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AxiosError } from "axios";

import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { sendAssistantChat } from "@/lib/api";
import { cn } from "@/lib/utils";
import type {
  AssistantAvailableSlot,
  ChatMessage,
  ChatResponse,
  ConversationUrgency,
} from "@/types/api";

const urgencyStyles: Record<ConversationUrgency, string> = {
  low: "bg-[#D1FAE5] text-[#065F46]",
  medium: "bg-[#FEF3C7] text-[#92400E]",
  high: "bg-[#FEE2E2] text-[#991B1B]",
  emergency: "bg-[#EF4444] text-white",
};

const intentLabels: Record<string, string> = {
  book_appointment: "Scheduling",
  reschedule_appointment: "Reschedule",
  cancel_appointment: "Cancellation",
  clinic_faq: "General Info",
  insurance_question: "Insurance",
  new_patient_intake: "Intake",
  urgent_escalation: "Emergency",
  general_question: "General",
};

function formatMessageTime(value: string) {
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return new Intl.DateTimeFormat("en-US", {
    month: sameDay ? undefined : "short",
    day: sameDay ? undefined : "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatAppointmentTime(value: string, timezone = "America/Phoenix") {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone: timezone,
  }).format(new Date(value));
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1.5 rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
        {[0, 1, 2].map((dot) => (
          <motion.span
            key={dot}
            className="h-2 w-2 rounded-full bg-[#94A3B8]"
            animate={{ scale: [1, 1.35, 1], opacity: [0.45, 1, 0.45] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: dot * 0.3 }}
          />
        ))}
      </div>
    </div>
  );
}

function AppointmentLookupCard({
  appointments,
}: {
  appointments: NonNullable<ChatMessage["patientAppointments"]>;
}) {
  if (appointments.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 text-[#0F172A] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
      <div className="mb-3 text-sm font-bold text-[#0F766E] dark:text-teal-300">
        Your Upcoming Appointments
      </div>
      <div className="grid gap-3">
        {appointments.slice(0, 5).map((appointment, index) => (
          <div
            key={appointment.id}
            className={cn(
              "grid gap-2 pb-3",
              index < appointments.length - 1 ? "border-b border-[#F1F5F9] dark:border-slate-700" : "pb-0",
            )}
          >
            <div className="flex items-start gap-3">
              <span className="rounded-full bg-[#F0FDFA] p-2 text-[#0F766E] dark:bg-teal-950/40 dark:text-teal-300">
                <CalendarDays className="h-4 w-4" />
              </span>
              <div>
                <p className="font-semibold">{appointment.provider_name}</p>
                <p className="text-sm text-[#64748B] dark:text-slate-400">
                  {appointment.service_name}
                </p>
                <p className="mt-1 font-bold">
                  {appointment.date} at {appointment.time}
                </p>
              </div>
              <span className="ml-auto rounded-full bg-[#D1FAE5] px-2 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#065F46]">
                {appointment.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmailLookupPrompt({
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (email: string) => void;
}) {
  const [email, setEmail] = useState("");

  return (
    <div className="mt-3 rounded-xl border border-[#0F766E] bg-[#F0FDFA] p-4 dark:border-teal-800 dark:bg-teal-950/30">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#0F766E] dark:text-teal-300">
        <Mail className="h-4 w-4" />
        Look up appointments by email
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Enter your email address"
          className="h-10 rounded-lg border border-[#CBD5E1] bg-white px-3 text-sm text-[#0F172A] outline-none transition-colors placeholder:text-[#94A3B8] focus:border-[#0F766E] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
        />
        <Button
          type="button"
          disabled={disabled || email.trim().length === 0}
          className="rounded-xl bg-[#0F766E] text-white hover:bg-[#0D9488]"
          onClick={() => onSubmit(email)}
        >
          Look Up Appointments
        </Button>
      </div>
    </div>
  );
}

function AvailableSlotList({
  slots,
  disabled,
  clinicTimezone,
  onSelect,
}: {
  slots: AssistantAvailableSlot[];
  disabled: boolean;
  clinicTimezone: string;
  onSelect: (slot: AssistantAvailableSlot) => void;
}) {
  return (
    <div className="mt-3 grid gap-2">
      <div className="text-xs font-bold uppercase tracking-[0.08em] text-[#0F766E]">
        Available times
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {slots.slice(0, 8).map((slot) => (
          <button
            key={slot.id}
            type="button"
            disabled={disabled}
            className="rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-left text-xs font-semibold text-[#0F172A] transition-colors hover:border-[#0F766E] hover:bg-[#F0FDFA] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => onSelect(slot)}
          >
            <span className="block">{formatAppointmentTime(slot.start_time, clinicTimezone)}</span>
            {slot.provider_name ? (
              <span className="mt-1 block font-medium text-[#64748B]">
                {slot.provider_name}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ChatWindow({
  clinicId,
  clinicName,
  clinicTimezone = "America/Phoenix",
  initialMessages,
  promptChips = [],
  externalMessage,
  onExternalMessageDone,
}: {
  clinicId: string;
  clinicName?: string;
  clinicTimezone?: string;
  initialMessages?: ChatMessage[];
  promptChips?: Array<{ label: string; icon: LucideIcon }>;
  externalMessage?: {
    id: string;
    content: string;
    request?: () => Promise<ChatResponse>;
    onDone?: (success: boolean) => void;
  };
  onExternalMessageDone?: (success: boolean) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(
    initialMessages ?? [
      {
        id: "welcome",
        sender: "assistant",
        content:
          clinicName
            ? `Hi, I am HealthDesk AI for ${clinicName}. I can show available appointment slots, answer clinic questions, and help route urgent messages.`
            : "Hi, I am HealthDesk AI. I can show available appointment slots, answer clinic questions, and help route urgent messages.",
        createdAt: new Date().toISOString(),
        urgency: "low",
      },
    ],
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>();
  const processedExternalMessageId = useRef<string | null>(null);
  const messageScrollRef = useRef<HTMLDivElement | null>(null);

  const latestUrgency = useMemo(
    () => [...messages].reverse().find((message) => message.urgency)?.urgency ?? "low",
    [messages],
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const container = messageScrollRef.current;
      if (container) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: "smooth",
        });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages.length, loading]);

  const sendMessage = useCallback(async (
    messageText: string,
    request?: () => Promise<ChatResponse>,
    displayText?: string,
  ) => {
    const trimmed = messageText.trim();
    if (!trimmed || loading) {
      return false;
    }

    setError("");
    setInput("");
    setLoading(true);
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      sender: "user",
      content: displayText?.trim() || trimmed,
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [...current, userMessage]);

    try {
      const response = request
        ? await request()
        : await sendAssistantChat({
            clinic_id: clinicId,
            message: trimmed,
            conversation_id: conversationId,
          });
      setConversationId(response.conversation_id);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          sender: "assistant",
          content: response.response,
          createdAt: new Date().toISOString(),
          urgency: response.urgency,
          intent: response.intent,
          appointment: response.appointment ?? null,
          availableSlots: response.available_slots,
          patientAppointments: response.patient_appointments,
          extractedData: response.extracted_data,
        },
      ]);
      return true;
    } catch (caught) {
      const error = caught as AxiosError<{ detail?: string }>;
      const detail = error.response?.data?.detail;
      const status = error.response?.status;
      if (
        status === 503 &&
        typeof detail === "string" &&
        (detail.includes("OPENAI_API_KEY") || detail.includes("GROQ_API_KEY"))
      ) {
        setError(
          "The AI backend is connected, but the selected AI provider is not configured. Add the provider key to the backend environment and restart Docker to get real assistant replies.",
        );
      } else if (typeof detail === "string") {
        setError(detail);
      } else {
        setError("The assistant could not reach the AI backend. Please try again.");
      }
      return false;
    } finally {
      setLoading(false);
    }
  }, [clinicId, conversationId, loading]);

  useEffect(() => {
    if (
      !externalMessage ||
      processedExternalMessageId.current === externalMessage.id ||
      loading
    ) {
      return;
    }
    processedExternalMessageId.current = externalMessage.id;
    void sendMessage(externalMessage.content, externalMessage.request).then((success) => {
      externalMessage.onDone?.(success);
      onExternalMessageDone?.(success);
    });
  }, [externalMessage, loading, onExternalMessageDone, sendMessage]);

  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <div className="flex flex-col gap-3 border-b border-[#F1F5F9] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#0F172A]">Patient conversation</h2>
          <p className="text-sm text-[#64748B]">Live assistant connected to the clinic workflow.</p>
        </div>
        <Badge className={cn("w-fit rounded-full px-3 py-1 uppercase tracking-[0.08em]", urgencyStyles[latestUrgency])}>
          {latestUrgency}
        </Badge>
      </div>

      {promptChips.length > 0 && (
        <div className="flex flex-wrap gap-2 border-b border-[#F1F5F9] p-3">
          {promptChips.map((chip) => (
            <Button
              key={chip.label}
              type="button"
              variant="outline"
              disabled={loading}
              className="h-9 rounded-xl border-[#CBD5E1] bg-white px-3 text-sm text-[#1E293B] hover:bg-[#F0FDFA] hover:text-[#0F766E]"
              onClick={() => void sendMessage(chip.label)}
            >
              <chip.icon className="mr-2 h-4 w-4" />
              {chip.label}
            </Button>
          ))}
        </div>
      )}

      <div ref={messageScrollRef} className="max-h-[50vh] min-h-[300px] space-y-4 overflow-y-auto bg-[#F8FAFC] px-4 py-4 sm:min-h-[360px] lg:min-h-[400px]">
        {messages.map((message) => {
          const intentLabel =
            message.sender === "assistant" && message.intent
              ? intentLabels[message.intent]
              : undefined;
          const showEmailPrompt =
            message.sender === "assistant" &&
            (message.extractedData?.needs_email === true ||
              message.content.toLowerCase().includes("share your email"));
          return (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className={cn(
              "flex flex-col",
              message.sender === "user" ? "items-end" : "items-start",
            )}
          >
            <div
              className={cn(
                "max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-6",
                message.sender === "user"
                  ? "bg-[#0F766E] text-white"
                  : "border border-[#E2E8F0] bg-white text-[#1E293B]",
              )}
            >
              {message.urgency === "emergency" && (
                <div className="mb-2 flex items-center gap-2 font-bold text-[#EF4444]">
                  <AlertTriangle className="h-4 w-4" />
                  Immediate staff review
                </div>
              )}
              {message.content}
              {message.availableSlots && message.availableSlots.length > 0 ? (
                <AvailableSlotList
                  slots={message.availableSlots}
                  disabled={loading}
                  clinicTimezone={clinicTimezone}
                  onSelect={(slot) => {
                    const providerText = slot.provider_name
                      ? ` with ${slot.provider_name}`
                      : "";
                    void sendMessage(
                      `I choose slot ${slot.id}`,
                      undefined,
                      `I choose ${formatAppointmentTime(slot.start_time, clinicTimezone)}${providerText}.`,
                    );
                  }}
                />
              ) : null}
              {message.appointment ? (
                <div className="mt-3 rounded-xl border border-[#CCFBF1] bg-[#F0FDFA] p-3 text-[#0F172A]">
                  <div className="text-xs font-bold uppercase tracking-[0.08em] text-[#0F766E]">
                    {message.appointment.status === "rescheduled" ||
                    message.intent === "reschedule_appointment"
                      ? "Appointment rescheduled"
                      : "Appointment booked"}
                  </div>
                  <div className="mt-2 space-y-1 text-sm">
                    <p>
                      <span className="font-semibold">Service:</span>{" "}
                      {message.appointment.service_name}
                    </p>
                    <p>
                      <span className="font-semibold">Provider:</span>{" "}
                      {message.appointment.provider_name}
                    </p>
                    <p>
                      <span className="font-semibold">Time:</span>{" "}
                      {formatAppointmentTime(message.appointment.start_time, clinicTimezone)}
                    </p>
                  </div>
                </div>
              ) : null}
              {message.patientAppointments && message.patientAppointments.length > 0 ? (
                <AppointmentLookupCard appointments={message.patientAppointments} />
              ) : null}
              {showEmailPrompt ? (
                <EmailLookupPrompt
                  disabled={loading}
                  onSubmit={(email) => {
                    void sendMessage(email, undefined, email);
                  }}
                />
              ) : null}
            </div>
            <div
              className={cn(
                "mt-1 flex items-center gap-2 text-xs text-[#94A3B8]",
                message.sender === "user" ? "justify-end" : "justify-start",
              )}
            >
              <span>{formatMessageTime(message.createdAt)}</span>
            </div>
            {intentLabel ? (
              <span className="mt-1 rounded-full bg-[#F0FDFA] px-2 py-0.5 text-xs font-semibold text-[#0F766E]">
                {intentLabel}
              </span>
            ) : null}
          </motion.div>
        );
        })}
        {loading ? <TypingIndicator /> : null}
      </div>

      <div className="space-y-3 border-t border-[#F1F5F9] p-3 sm:p-4">
        {error && (
          <div className="rounded-xl bg-[#FEF3C7] px-4 py-3 text-sm font-medium text-[#92400E]">
            {error}
          </div>
        )}
        <Textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          className="min-h-16 rounded-lg border-[#CBD5E1] bg-[#F1F5F9] text-[#0F172A]"
          aria-label="Message to HealthDesk AI"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void sendMessage(input);
            }
          }}
        />
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() => void sendMessage(input)}
            disabled={loading || input.trim().length === 0}
            className="rounded-xl bg-[#0F766E] text-white hover:bg-[#0D9488]"
          >
            {loading ? <LoadingSpinner label="Sending" className="text-white" /> : <SendHorizonal className="mr-2 h-4 w-4" />}
            {!loading && "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}
