"use client";

import { useCallback, useEffect, useState } from "react";

import {
  getAnalyticsOverview,
  getAppointmentStatusCounts,
  getCommonQuestions,
  getInquiriesByDay,
  getPeakHours,
} from "@/lib/api";
import type { AnalyticsData } from "@/types/api";

const emptyAnalytics: AnalyticsData = {
  overview: {
    total_conversations: 0,
    booked_appointments: 0,
    rescheduled_appointments: 0,
    cancelled_appointments: 0,
    open_escalations: 0,
    pending_intake_forms: 0,
    booking_conversion_rate: 0,
  },
  inquiriesByDay: [],
  appointmentStatus: [],
  commonQuestions: [],
  peakHours: [],
};

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : "Unable to load analytics.";
}

export function useAnalytics() {
  const [data, setData] = useState<AnalyticsData>(emptyAnalytics);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refetch = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [overview, inquiriesByDay, appointmentStatus, commonQuestions, peakHours] =
        await Promise.all([
          getAnalyticsOverview(),
          getInquiriesByDay(),
          getAppointmentStatusCounts(),
          getCommonQuestions(),
          getPeakHours(),
        ]);
      setData({ overview, inquiriesByDay, appointmentStatus, commonQuestions, peakHours });
    } catch (caught) {
      setError(messageFromError(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refetch(), 0);
    const interval = window.setInterval(() => void refetch(), 15000);
    const handleFocus = () => void refetch();
    window.addEventListener("focus", handleFocus);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [refetch]);

  return { data, loading, error, refetch };
}
