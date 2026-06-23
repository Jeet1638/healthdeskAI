"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { getConversations } from "@/lib/api";
import type { ConversationChannel, ConversationListItem, ConversationUrgency } from "@/types/api";

export interface ConversationFilters {
  search: string;
  channel: ConversationChannel | "all";
  urgency: ConversationUrgency | "all";
  status: string;
}

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : "Unable to load conversations.";
}

export function useConversations(filters?: ConversationFilters) {
  const [rawData, setRawData] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refetch = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRawData(await getConversations());
    } catch (caught) {
      setError(messageFromError(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refetch(), 0);
    return () => window.clearTimeout(timer);
  }, [refetch]);

  const data = useMemo(() => {
    if (!filters) {
      return rawData;
    }
    const searchTerm = filters.search.trim().toLowerCase();
    return rawData.filter((conversation) => {
      const matchesSearch =
        !searchTerm ||
        `${conversation.patient_name ?? "Unknown patient"} ${conversation.category ?? ""}`
          .toLowerCase()
          .includes(searchTerm);
      const matchesChannel = filters.channel === "all" || conversation.channel === filters.channel;
      const matchesUrgency = filters.urgency === "all" || conversation.urgency === filters.urgency;
      const matchesStatus = filters.status === "all" || conversation.status === filters.status;
      return matchesSearch && matchesChannel && matchesUrgency && matchesStatus;
    });
  }, [filters, rawData]);

  return { data, loading, error, refetch };
}
