"use client";

import { useCallback, useEffect, useState } from "react";

import {
  cancelAppointment,
  createAppointment,
  getAppointments,
  getAppointmentSlots,
  getProviders,
  getServices,
  rescheduleAppointment,
  type AppointmentFilters,
  type AppointmentSlotFilters,
} from "@/lib/api";
import type {
  Appointment,
  AppointmentCreatePayload,
  AppointmentSlot,
  ProviderOption,
  ServiceOption,
} from "@/types/api";

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : "Unable to load appointments.";
}

export function useAppointments(filters: AppointmentFilters = {}) {
  const [data, setData] = useState<Appointment[]>([]);
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [slots, setSlots] = useState<AppointmentSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [error, setError] = useState("");

  const refetch = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [appointments, providerOptions, serviceOptions] = await Promise.all([
        getAppointments(filters),
        getProviders(true),
        getServices(true),
      ]);
      setData(appointments);
      setProviders(providerOptions);
      setServices(serviceOptions);
    } catch (caught) {
      setError(messageFromError(caught));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchSlots = useCallback(async (slotFilters: AppointmentSlotFilters = {}) => {
    setSlotsLoading(true);
    try {
      const availableSlots = await getAppointmentSlots(slotFilters);
      setSlots(availableSlots);
      return availableSlots;
    } finally {
      setSlotsLoading(false);
    }
  }, []);

  const create = useCallback(
    async (payload: AppointmentCreatePayload) => {
      const appointment = await createAppointment(payload);
      await refetch();
      return appointment;
    },
    [refetch],
  );

  const reschedule = useCallback(
    async (appointmentId: string, newSlotId: string) => {
      const appointment = await rescheduleAppointment(appointmentId, newSlotId);
      await refetch();
      return appointment;
    },
    [refetch],
  );

  const cancel = useCallback(
    async (appointmentId: string) => {
      const appointment = await cancelAppointment(appointmentId);
      await refetch();
      return appointment;
    },
    [refetch],
  );

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

  return {
    data,
    providers,
    services,
    slots,
    loading,
    slotsLoading,
    error,
    refetch,
    fetchSlots,
    create,
    reschedule,
    cancel,
  };
}
