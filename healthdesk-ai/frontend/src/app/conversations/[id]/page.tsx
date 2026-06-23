"use client";

import { motion } from "framer-motion";
import { AlertTriangle, FileText, MessageSquare, Send } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addStaffMessage, getConversation, summarizeConversation } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ConversationDetail, MessageRead } from "@/types/api";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function senderLabel(sender: MessageRead["sender"]) {
  return sender === "user" ? "Patient" : sender === "assistant" ? "Assistant" : sender === "staff" ? "Staff" : "System";
}

export default function ConversationDetailPage() {
  const params = useParams<{ id: string }>();
  const conversationId = params.id;
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [noteLoading, setNoteLoading] = useState(false);
  const [staffNote, setStaffNote] = useState("");
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        setConversation(await getConversation(conversationId));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Unable to load conversation.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [conversationId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages.length]);

  const generateSummary = async () => {
    setSummaryLoading(true);
    try {
      const result = await summarizeConversation(conversationId);
      setConversation((current) => (current ? { ...current, summary: result.summary } : current));
      toast.success("Summary generated");
    } catch {
      toast.error("Summary could not be generated");
    } finally {
      setSummaryLoading(false);
    }
  };

  const submitStaffNote = async () => {
    const content = staffNote.trim();
    if (!content) {
      return;
    }
    setNoteLoading(true);
    try {
      const message = await addStaffMessage(conversationId, content);
      setConversation((current) =>
        current ? { ...current, messages: [...current.messages, message] } : current,
      );
      setStaffNote("");
      toast.success("Staff note added");
    } catch {
      toast.error("Staff note could not be added");
    } finally {
      setNoteLoading(false);
    }
  };

  return (
    <ProtectedLayout>
      <main className="hd-page">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-sm font-bold uppercase tracking-[0.08em] text-[#0F766E]">Conversation detail</p>
          <h1 className="mt-2 text-3xl font-bold text-[#0F172A]">{conversation?.patient ? `${conversation.patient.first_name} ${conversation.patient.last_name}` : "Patient conversation"}</h1>
          <p className="mt-2 text-[#64748B]">Review the full transcript, generate a summary, and add staff-visible notes.</p>
        </motion.div>

        {loading ? (
          <div className="mt-10 flex min-h-[320px] items-center justify-center rounded-2xl border border-[#E2E8F0] bg-white">
            <LoadingSpinner label="Loading conversation" />
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-2xl border border-[#FEE2E2] bg-[#FEE2E2] p-4 text-[#991B1B]">{error}</div>
        ) : null}

        {conversation ? (
          <section className="mt-8 grid gap-6 lg:grid-cols-[0.6fr_0.4fr]">
            <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
              <div className="border-b border-[#F1F5F9] p-5">
                <h2 className="flex items-center gap-2 text-lg font-bold text-[#0F172A]">
                  <MessageSquare className="h-5 w-5 text-[#0F766E]" />
                  Transcript
                </h2>
              </div>
              <div className="max-h-[680px] space-y-4 overflow-y-auto bg-[#F8FAFC] p-5">
                {conversation.messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "flex",
                      message.sender === "user" ? "justify-end" : message.sender === "system" ? "justify-center" : "justify-start",
                    )}
                  >
                    {message.sender === "system" ? (
                      <p className="max-w-[80%] text-center text-xs italic text-[#64748B]">{message.content}</p>
                    ) : (
                      <div
                        className={cn(
                          "max-w-[82%] rounded-2xl px-4 py-3",
                          message.sender === "user" && "rounded-tr-sm bg-[#0F766E] text-white",
                          message.sender === "assistant" && "rounded-tl-sm border border-[#E2E8F0] bg-white text-[#1E293B]",
                          message.sender === "staff" && "rounded-tl-sm bg-[#EDE9FE] text-[#5B21B6]",
                        )}
                      >
                        <p className="text-sm leading-6">{message.content}</p>
                        <p className={cn("mt-2 text-xs", message.sender === "user" ? "text-white/75" : "text-[#64748B]")}>
                          {senderLabel(message.sender)} • {formatDateTime(message.created_at)}
                        </p>
                      </div>
                    )}
                  </motion.div>
                ))}
                <div ref={endRef} />
              </div>
            </div>

            <aside className="space-y-5">
              <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                <h2 className="text-lg font-bold text-[#0F172A]">Patient info</h2>
                {conversation.patient ? (
                  <div className="mt-4 space-y-2 text-sm">
                    <p className="font-semibold text-[#0F172A]">{conversation.patient.first_name} {conversation.patient.last_name}</p>
                    <p className="text-[#64748B]">{conversation.patient.email ?? "No email"}</p>
                    <p className="text-[#64748B]">{conversation.patient.phone ?? "No phone"}</p>
                    <StatusBadge status={conversation.patient.new_patient ? "new" : "returning"} type="patient" />
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-[#64748B]">No patient record is linked yet.</p>
                )}
              </section>

              <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                <h2 className="text-lg font-bold text-[#0F172A]">Conversation info</h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  <StatusBadge status={conversation.channel} type="channel" />
                  <StatusBadge status={conversation.urgency} type="urgency" />
                  <span className="rounded-full bg-[#F1F5F9] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#64748B]">{conversation.status}</span>
                </div>
                <p className="mt-4 text-sm text-[#64748B]">Category: {conversation.category ?? "uncategorized"}</p>
                <p className="mt-1 text-sm text-[#64748B]">Created: {formatDateTime(conversation.created_at)}</p>
              </section>

              <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                <h2 className="flex items-center gap-2 text-lg font-bold text-[#0F172A]">
                  <FileText className="h-5 w-5 text-[#0F766E]" />
                  AI Summary
                </h2>
                {conversation.summary ? (
                  <p className="mt-4 rounded-2xl bg-[#F0FDFA] p-4 text-sm leading-6 text-[#1E293B]">{conversation.summary}</p>
                ) : (
                  <div className="mt-4 rounded-2xl bg-[#F8FAFC] p-4">
                    <p className="text-sm text-[#64748B]">No summary yet.</p>
                    <Button type="button" className="mt-3 rounded-xl bg-[#0F766E] text-white hover:bg-[#0D9488]" onClick={() => void generateSummary()} disabled={summaryLoading}>
                      {summaryLoading ? <LoadingSpinner label="Generating" /> : "Generate Summary"}
                    </Button>
                  </div>
                )}
              </section>

              {conversation.urgency === "emergency" ? (
                <section className="rounded-2xl border border-[#EF4444] bg-[#FEE2E2] p-5 text-[#991B1B]">
                  <h2 className="flex items-center gap-2 font-bold">
                    <AlertTriangle className="h-5 w-5" />
                    Emergency escalation flagged
                  </h2>
                  <p className="mt-2 text-sm">This conversation requires immediate staff review.</p>
                  <Button type="button" className="mt-4 rounded-xl bg-[#EF4444] text-white hover:bg-[#DC2626]" onClick={() => toast.success("Staff notification queued")}>Notify Staff</Button>
                </section>
              ) : null}

              <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                <h2 className="text-lg font-bold text-[#0F172A]">Add Staff Note</h2>
                <Textarea
                  value={staffNote}
                  onChange={(event) => setStaffNote(event.target.value)}
                  placeholder="Add an internal note for the clinic team"
                  className="mt-4 min-h-28 rounded-xl border-[#CBD5E1] bg-[#F1F5F9]"
                />
                <Button type="button" className="mt-3 rounded-xl bg-[#0F766E] text-white hover:bg-[#0D9488]" disabled={noteLoading || !staffNote.trim()} onClick={() => void submitStaffNote()}>
                  {noteLoading ? <LoadingSpinner label="Saving" /> : <><Send className="mr-2 h-4 w-4" />Submit Note</>}
                </Button>
              </section>
            </aside>
          </section>
        ) : null}
      </main>
    </ProtectedLayout>
  );
}
