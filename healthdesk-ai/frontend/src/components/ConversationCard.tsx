"use client";

import { motion } from "framer-motion";
import Link from "next/link";

import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import type { ConversationListItem } from "@/types/api";

function timeAgo(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return `${Math.round(hours / 24)}d ago`;
}

export function ConversationCard({
  conversation,
}: {
  conversation: ConversationListItem;
}) {
  const summary = conversation.summary?.trim() || "No summary yet";

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)] dark:border-slate-700 dark:bg-slate-800 dark:hover:shadow-[0_12px_32px_rgba(0,0,0,0.24)]"
    >
      <div className="grid gap-4 lg:grid-cols-[0.28fr_1fr_auto] lg:items-center">
        <div>
          <h2 className="font-bold text-[#0F172A] dark:text-slate-100">{conversation.patient_name ?? "Unknown patient"}</h2>
          <p className="mt-1 text-sm text-[#64748B]">{conversation.category ?? "uncategorized"}</p>
        </div>
        <p className="text-sm leading-6 text-[#1E293B]">
          {summary.length > 100 ? `${summary.slice(0, 100)}...` : summary}
        </p>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <StatusBadge status={conversation.urgency} type="urgency" />
          <StatusBadge status={conversation.channel} type="channel" />
          <span className="text-sm text-[#64748B]">{timeAgo(conversation.updated_at)}</span>
          <Button
            asChild
            variant="outline"
            className="rounded-xl border-[#0F766E] text-[#0F766E] hover:bg-[#F0FDFA]"
          >
            <Link href={`/conversations/${conversation.id}`}>View Details</Link>
          </Button>
        </div>
      </div>
    </motion.article>
  );
}
