"use client";

import { motion } from "framer-motion";
import { MessageSquare, Search } from "lucide-react";
import { useState } from "react";

import { ConversationCard } from "@/components/ConversationCard";
import { EmptyState } from "@/components/EmptyState";
import { HealthSelect } from "@/components/HealthSelect";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { SkeletonRows } from "@/components/Skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/useDebounce";
import { useConversations, type ConversationFilters } from "@/hooks/useConversations";

export default function ConversationsPage() {
  const [filters, setFilters] = useState<ConversationFilters>({
    search: "",
    channel: "all",
    urgency: "all",
    status: "all",
  });
  const debouncedSearch = useDebounce(filters.search, 300);
  const appliedFilters = { ...filters, search: debouncedSearch };
  const { data, loading, error, refetch } = useConversations(appliedFilters);

  return (
    <ProtectedLayout>
      <main className="hd-page">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-sm font-bold uppercase tracking-[0.08em] text-[#0F766E]">Staff queue</p>
          <h1 className="mt-2 text-3xl font-bold text-[#0F172A]">Conversations</h1>
          <p className="mt-2 text-[#64748B]">Review patient messages with urgency labels and staff-ready summaries.</p>
        </motion.div>

        <section className="mt-8 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px_180px]">
            <label className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <Input
                value={filters.search}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                placeholder="Search patient or category"
                className="h-11 rounded-xl border-[#CBD5E1] bg-[#F1F5F9] pl-10"
              />
            </label>
            <HealthSelect
              value={filters.channel}
              onValueChange={(value) => setFilters((current) => ({ ...current, channel: value as ConversationFilters["channel"] }))}
              options={[
                { value: "all", label: "All channels" },
                { value: "chat", label: "Chat" },
                { value: "voice", label: "Voice" },
              ]}
              ariaLabel="Filter by channel"
            />
            <HealthSelect
              value={filters.urgency}
              onValueChange={(value) => setFilters((current) => ({ ...current, urgency: value as ConversationFilters["urgency"] }))}
              options={[
                { value: "all", label: "All urgency" },
                { value: "low", label: "Low" },
                { value: "medium", label: "Medium" },
                { value: "high", label: "High" },
                { value: "emergency", label: "Emergency" },
              ]}
              ariaLabel="Filter by urgency"
            />
            <HealthSelect
              value={filters.status}
              onValueChange={(value) => setFilters((current) => ({ ...current, status: value }))}
              options={[
                { value: "all", label: "All status" },
                { value: "open", label: "Open" },
                { value: "closed", label: "Closed" },
              ]}
              ariaLabel="Filter by status"
            />
          </div>
        </section>

        {error ? (
          <div className="mt-6 flex items-center justify-between rounded-2xl border border-[#FEE2E2] bg-[#FEE2E2] p-4 text-[#991B1B]">
            <span>{error}</span>
            <Button type="button" variant="outline" onClick={() => void refetch()}>Retry</Button>
          </div>
        ) : null}

        <section className="mt-6 grid gap-4">
          {loading ? <SkeletonRows rows={6} /> : null}
          {!loading && data.length === 0 ? (
            <EmptyState icon={MessageSquare} title="No conversations yet" message="Patient conversations will appear here when the assistant starts handling requests." />
          ) : null}
          {!loading ? data.map((conversation) => <ConversationCard key={conversation.id} conversation={conversation} />) : null}
        </section>
      </main>
    </ProtectedLayout>
  );
}
