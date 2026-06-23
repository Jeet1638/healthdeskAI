"use client";

import axios, { AxiosError, type AxiosResponse } from "axios";
import { getSession } from "next-auth/react";

import type {
  AnalyticsOverview,
  Appointment,
  AppointmentCreatePayload,
  AppointmentLookupResponse,
  AppointmentSlot,
  AppointmentSlotCreatePayload,
  AppointmentStatus,
  AppointmentStatusCountItem,
  ChatRequest,
  ChatResponse,
  ClinicResponse,
  ClinicUpdateRequest,
  CommonQuestionItem,
  ConversationDetail,
  ConversationListItem,
  ConversationUrgency,
  FAQItem,
  FAQPayload,
  InquiriesByDayItem,
  IntakeForm,
  LoginRequest,
  Patient,
  PatientCreatePayload,
  PatientDetail,
  PatientListResponse,
  PatientUpdatePayload,
  PeakHourItem,
  ProviderOption,
  ProviderPayload,
  PublicAppointmentRequest,
  PublicAppointmentResponse,
  PublicClinicResponse,
  RegisterRequest,
  ServiceOption,
  ServicePayload,
  TokenResponse,
  UserWithClinicResponse,
  VoiceTranscriptRequest,
} from "@/types/api";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(async (config) => {
  if (typeof window !== "undefined") {
    const session = await getSession();
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (
      typeof window !== "undefined" &&
      error.response?.status === 401 &&
      !window.location.pathname.startsWith("/login")
    ) {
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

const unwrap = <T>(response: AxiosResponse<T>) => response.data;

export async function registerUser(payload: RegisterRequest): Promise<TokenResponse> {
  return unwrap(await api.post<TokenResponse>("/auth/register", payload));
}

export async function loginUser(payload: LoginRequest): Promise<TokenResponse> {
  return unwrap(await api.post<TokenResponse>("/auth/login", payload));
}

export async function getCurrentUser(token?: string): Promise<UserWithClinicResponse> {
  return unwrap(
    await api.get<UserWithClinicResponse>("/auth/me", {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }),
  );
}

export async function getMyClinic(token?: string): Promise<ClinicResponse> {
  return unwrap(
    await api.get<ClinicResponse>("/clinics/me", {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }),
  );
}

export async function updateMyClinic(
  payload: ClinicUpdateRequest,
): Promise<ClinicResponse> {
  return unwrap(await api.patch<ClinicResponse>("/clinics/me", payload));
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function getPublicClinic(): Promise<PublicClinicResponse> {
  return unwrap(await api.get<PublicClinicResponse>("/ai/public-clinic"));
}

export async function getPublicClinics(): Promise<PublicClinicResponse[]> {
  return unwrap(await api.get<PublicClinicResponse[]>("/ai/public-clinics"));
}

export async function sendAssistantChat(payload: ChatRequest): Promise<ChatResponse> {
  const clinicId = uuidPattern.test(payload.clinic_id)
    ? payload.clinic_id
    : (await getPublicClinic()).clinic_id;

  return unwrap(
    await api.post<ChatResponse>("/ai/chat", {
      ...payload,
      clinic_id: clinicId,
    }),
  );
}

export async function sendVoiceTranscript(
  payload: VoiceTranscriptRequest,
): Promise<ChatResponse> {
  const clinicId = uuidPattern.test(payload.clinic_id)
    ? payload.clinic_id
    : (await getPublicClinic()).clinic_id;

  return unwrap(
    await api.post<ChatResponse>("/ai/voice/transcript", {
      ...payload,
      clinic_id: clinicId,
    }),
  );
}

export async function requestAppointmentWithAssistant(
  payload: PublicAppointmentRequest,
): Promise<PublicAppointmentResponse> {
  const clinicId = uuidPattern.test(payload.clinic_id)
    ? payload.clinic_id
    : (await getPublicClinic()).clinic_id;

  return unwrap(
    await api.post<PublicAppointmentResponse>("/ai/appointment-request", {
      ...payload,
      clinic_id: clinicId,
    }),
  );
}

export async function getAnalyticsOverview(): Promise<AnalyticsOverview> {
  return unwrap(await api.get<AnalyticsOverview>("/analytics/overview"));
}

export async function getInquiriesByDay(): Promise<InquiriesByDayItem[]> {
  return unwrap(await api.get<InquiriesByDayItem[]>("/analytics/inquiries-by-day"));
}

export async function getAppointmentStatusCounts(): Promise<AppointmentStatusCountItem[]> {
  return unwrap(await api.get<AppointmentStatusCountItem[]>("/analytics/appointment-status"));
}

export async function getCommonQuestions(): Promise<CommonQuestionItem[]> {
  return unwrap(await api.get<CommonQuestionItem[]>("/analytics/common-questions"));
}

export async function getPeakHours(): Promise<PeakHourItem[]> {
  return unwrap(await api.get<PeakHourItem[]>("/analytics/peak-hours"));
}

export async function getConversations(): Promise<ConversationListItem[]> {
  return unwrap(await api.get<ConversationListItem[]>("/conversations"));
}

export async function getConversation(id: string): Promise<ConversationDetail> {
  return unwrap(await api.get<ConversationDetail>(`/conversations/${id}`));
}

export async function addStaffMessage(
  conversationId: string,
  content: string,
): Promise<ConversationDetail["messages"][number]> {
  return unwrap(
    await api.post<ConversationDetail["messages"][number]>(
      `/conversations/${conversationId}/message`,
      { content },
    ),
  );
}

export async function summarizeConversation(conversationId: string): Promise<{ summary: string }> {
  return unwrap(await api.post<{ summary: string }>(`/conversations/${conversationId}/summarize`));
}

export interface AppointmentFilters {
  status?: AppointmentStatus | "all";
  provider_id?: string;
  date_from?: string;
  date_to?: string;
}

export async function getAppointments(filters: AppointmentFilters = {}): Promise<Appointment[]> {
  return unwrap(
    await api.get<Appointment[]>("/appointments", {
      params: {
        ...filters,
        status: filters.status === "all" ? undefined : filters.status,
      },
    }),
  );
}

export async function lookupAppointments(
  clinicId: string,
  email: string,
): Promise<AppointmentLookupResponse> {
  return unwrap(
    await api.get<AppointmentLookupResponse>("/appointments/lookup", {
      params: { clinic_id: clinicId, email },
    }),
  );
}

export async function createAppointment(payload: AppointmentCreatePayload): Promise<Appointment> {
  return unwrap(await api.post<Appointment>("/appointments", payload));
}

export async function rescheduleAppointment(
  appointmentId: string,
  newSlotId: string,
): Promise<Appointment> {
  return unwrap(
    await api.patch<Appointment>(`/appointments/${appointmentId}/reschedule`, {
      new_slot_id: newSlotId,
    }),
  );
}

export async function cancelAppointment(appointmentId: string): Promise<Appointment> {
  return unwrap(await api.patch<Appointment>(`/appointments/${appointmentId}/cancel`));
}

export interface AppointmentSlotFilters {
  provider_id?: string;
  service_id?: string;
  date_from?: string;
  date_to?: string;
}

export async function getAppointmentSlots(
  filters: AppointmentSlotFilters = {},
): Promise<AppointmentSlot[]> {
  return unwrap(await api.get<AppointmentSlot[]>("/appointment-slots", { params: filters }));
}

export async function createAppointmentSlot(
  payload: AppointmentSlotCreatePayload,
): Promise<AppointmentSlot> {
  return unwrap(await api.post<AppointmentSlot>("/appointment-slots", payload));
}

export async function getProviders(active?: boolean): Promise<ProviderOption[]> {
  return unwrap(await api.get<ProviderOption[]>("/providers", { params: { active } }));
}

export async function createProvider(payload: ProviderPayload): Promise<ProviderOption> {
  return unwrap(await api.post<ProviderOption>("/providers", payload));
}

export async function updateProvider(
  providerId: string,
  payload: Partial<ProviderPayload> & { active?: boolean },
): Promise<ProviderOption> {
  return unwrap(await api.patch<ProviderOption>(`/providers/${providerId}`, payload));
}

export async function deleteProvider(providerId: string): Promise<ProviderOption> {
  return unwrap(await api.delete<ProviderOption>(`/providers/${providerId}`));
}

export async function getServices(active?: boolean): Promise<ServiceOption[]> {
  return unwrap(await api.get<ServiceOption[]>("/services", { params: { active } }));
}

export async function createService(payload: ServicePayload): Promise<ServiceOption> {
  return unwrap(await api.post<ServiceOption>("/services", payload));
}

export async function updateService(
  serviceId: string,
  payload: Partial<ServicePayload> & { active?: boolean },
): Promise<ServiceOption> {
  return unwrap(await api.patch<ServiceOption>(`/services/${serviceId}`, payload));
}

export async function deleteService(serviceId: string): Promise<ServiceOption> {
  return unwrap(await api.delete<ServiceOption>(`/services/${serviceId}`));
}

export async function getFaqs(): Promise<FAQItem[]> {
  return unwrap(await api.get<FAQItem[]>("/faqs"));
}

export async function createFaq(payload: FAQPayload): Promise<FAQItem> {
  return unwrap(await api.post<FAQItem>("/faqs", payload));
}

export async function updateFaq(faqId: string, payload: Partial<FAQPayload>): Promise<FAQItem> {
  return unwrap(await api.patch<FAQItem>(`/faqs/${faqId}`, payload));
}

export async function deleteFaq(faqId: string): Promise<{ message: string }> {
  return unwrap(await api.delete<{ message: string }>(`/faqs/${faqId}`));
}

export interface PatientFilters {
  search?: string;
  new_patient?: boolean;
  page?: number;
  page_size?: number;
}

export async function getPatients(filters: PatientFilters = {}): Promise<PatientListResponse> {
  return unwrap(await api.get<PatientListResponse>("/patients", { params: filters }));
}

export async function createPatient(payload: PatientCreatePayload): Promise<Patient> {
  return unwrap(await api.post<Patient>("/patients", payload));
}

export async function getPatient(id: string): Promise<PatientDetail> {
  return unwrap(await api.get<PatientDetail>(`/patients/${id}`));
}

export async function updatePatient(id: string, payload: PatientUpdatePayload): Promise<Patient> {
  return unwrap(await api.patch<Patient>(`/patients/${id}`, payload));
}

export interface IntakeFormFilters {
  urgency?: ConversationUrgency | "all";
  date_from?: string;
  date_to?: string;
}

export async function getIntakeForms(filters: IntakeFormFilters = {}): Promise<IntakeForm[]> {
  return unwrap(
    await api.get<IntakeForm[]>("/intake-forms", {
      params: {
        ...filters,
        urgency: filters.urgency === "all" ? undefined : filters.urgency,
      },
    }),
  );
}

export async function extractIntake(conversationId: string): Promise<{
  reason_for_visit: string | null;
  insurance_provider: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  symptoms: string | null;
}> {
  return unwrap(
    await api.post("/ai/extract-intake", {
      conversation_id: conversationId,
    }),
  );
}
