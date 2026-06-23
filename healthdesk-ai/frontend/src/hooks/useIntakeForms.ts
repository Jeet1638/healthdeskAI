"use client";

import { useCallback, useEffect, useState } from "react";

import {
  extractIntake,
  getIntakeForms,
  summarizeConversation,
  type IntakeFormFilters,
} from "@/lib/api";
import type { IntakeForm } from "@/types/api";

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : "Unable to load intake forms.";
}

export function useIntakeForms(filters: IntakeFormFilters = {}) {
  const [data, setData] = useState<IntakeForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refetch = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await getIntakeForms(filters));
    } catch (caught) {
      setError(messageFromError(caught));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const generateSummary = useCallback(
    async (conversationId: string) => {
      await summarizeConversation(conversationId);
      await extractIntake(conversationId);
      await refetch();
    },
    [refetch],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void refetch(), 0);
    return () => window.clearTimeout(timer);
  }, [refetch]);

  return { data, loading, error, refetch, generateSummary };
}
