"use client";

import { useCallback, useEffect, useState } from "react";

import {
  createPatient,
  getPatient,
  getPatients,
  updatePatient,
  type PatientFilters,
} from "@/lib/api";
import type {
  Patient,
  PatientCreatePayload,
  PatientDetail,
  PatientListResponse,
  PatientUpdatePayload,
} from "@/types/api";

const emptyPatients: PatientListResponse = {
  items: [],
  total: 0,
  page: 1,
  page_size: 20,
};

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : "Unable to load patients.";
}

export function usePatients(filters: PatientFilters = {}) {
  const [data, setData] = useState<PatientListResponse>(emptyPatients);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refetch = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await getPatients(filters));
    } catch (caught) {
      setError(messageFromError(caught));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const create = useCallback(
    async (payload: PatientCreatePayload) => {
      const patient = await createPatient(payload);
      await refetch();
      return patient;
    },
    [refetch],
  );

  const update = useCallback(
    async (id: string, payload: PatientUpdatePayload) => {
      const patient = await updatePatient(id, payload);
      await refetch();
      return patient;
    },
    [refetch],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void refetch(), 0);
    return () => window.clearTimeout(timer);
  }, [refetch]);

  return { data, loading, error, refetch, create, update };
}

export function usePatientDetail(patientId: string) {
  const [data, setData] = useState<PatientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refetch = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await getPatient(patientId));
    } catch (caught) {
      setError(messageFromError(caught));
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  const update = useCallback(
    async (payload: PatientUpdatePayload): Promise<Patient> => {
      const patient = await updatePatient(patientId, payload);
      await refetch();
      return patient;
    },
    [patientId, refetch],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void refetch(), 0);
    return () => window.clearTimeout(timer);
  }, [refetch]);

  return { data, loading, error, refetch, update };
}
