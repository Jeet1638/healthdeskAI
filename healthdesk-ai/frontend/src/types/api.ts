export type Role = "admin" | "staff";
export type ConversationUrgency = "low" | "medium" | "high" | "emergency";
export type ChatSender = "user" | "assistant" | "staff" | "system";
export type ConversationChannel = "chat" | "voice";
export type AppointmentStatus =
  | "scheduled"
  | "rescheduled"
  | "cancelled"
  | "completed"
  | "no_show";

export interface UserResponse {
  id: string;
  name: string;
  email: string;
  role: Role;
  clinic_id: string | null;
  created_at: string;
}

export interface ClinicResponse {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  timezone: string;
  opening_hours: Record<string, string>;
  email_notifications_escalation: boolean;
  email_notifications_appointments: boolean;
  created_at: string;
}

export interface UserWithClinicResponse extends UserResponse {
  clinic: ClinicResponse | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: "bearer";
  user: UserResponse;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  clinic_name: string;
  role: Role;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ClinicUpdateRequest {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  timezone?: string;
  opening_hours?: Record<string, string>;
  email_notifications_escalation?: boolean;
  email_notifications_appointments?: boolean;
}

export interface AssistantAppointment {
  id: string;
  patient_id: string;
  provider_id: string;
  provider_name: string;
  service_id: string;
  service_name: string;
  slot_id: string;
  status: AppointmentStatus;
  start_time: string;
  end_time: string;
  reason: string | null;
}

export interface AssistantAvailableSlot {
  id: string;
  provider_id: string;
  provider_name: string | null;
  start_time: string;
  end_time: string;
}

export interface PatientAppointmentLookup {
  id: string;
  provider_name: string;
  service_name: string;
  date: string;
  time: string;
  status: AppointmentStatus;
}

export interface AppointmentLookupResponse {
  found: boolean;
  patient_name: string | null;
  appointments: PatientAppointmentLookup[];
}

export interface ChatMessage {
  id: string;
  sender: ChatSender;
  content: string;
  createdAt: string;
  urgency?: ConversationUrgency;
  intent?: string;
  appointment?: AssistantAppointment | null;
  availableSlots?: AssistantAvailableSlot[];
  patientAppointments?: PatientAppointmentLookup[];
  extractedData?: Record<string, unknown>;
}

export interface ChatRequest {
  clinic_id: string;
  message: string;
  conversation_id?: string;
}

export interface VoiceTranscriptRequest {
  clinic_id: string;
  transcript: string;
  conversation_id?: string;
}

export interface ChatResponse {
  conversation_id: string;
  response: string;
  intent: string;
  urgency: ConversationUrgency;
  needs_human: boolean;
  extracted_data: Record<string, unknown>;
  available_slots: AssistantAvailableSlot[];
  patient_appointments: PatientAppointmentLookup[];
  appointment?: AssistantAppointment | null;
}

export interface PublicAppointmentRequest {
  clinic_id: string;
  patient_name: string;
  email: string;
  phone: string;
  service: string;
  preferred_date: string;
  preferred_time?: string | null;
  reason?: string | null;
  new_patient: boolean;
}

export interface PublicAppointmentResponse extends ChatResponse {
  appointment: AssistantAppointment | null;
}

export interface PublicClinicResponse {
  clinic_id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  timezone: string;
  provider_count?: number;
  service_count?: number;
  available_slot_count?: number;
}

export interface ProviderOption {
  id: string;
  name: string;
  specialty: string | null;
  email: string | null;
  active: boolean;
}

export interface ProviderPayload {
  name: string;
  specialty?: string | null;
  email?: string | null;
}

export interface ServiceOption {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  active: boolean;
}

export interface ServicePayload {
  name: string;
  description?: string | null;
  duration_minutes: number;
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  active: boolean;
  created_at: string;
}

export interface FAQPayload {
  question: string;
  answer: string;
  category?: string | null;
  active?: boolean;
}

export interface AnalyticsOverview {
  total_conversations: number;
  booked_appointments: number;
  rescheduled_appointments: number;
  cancelled_appointments: number;
  open_escalations: number;
  pending_intake_forms: number;
  booking_conversion_rate: number;
}

export interface InquiriesByDayItem {
  date: string;
  count: number;
}

export interface AppointmentStatusCountItem {
  status: AppointmentStatus;
  count: number;
}

export interface CommonQuestionItem {
  category: string;
  count: number;
}

export interface PeakHourItem {
  hour: number;
  count: number;
}

export interface AnalyticsData {
  overview: AnalyticsOverview;
  inquiriesByDay: InquiriesByDayItem[];
  appointmentStatus: AppointmentStatusCountItem[];
  commonQuestions: CommonQuestionItem[];
  peakHours: PeakHourItem[];
}

export interface ConversationListItem {
  id: string;
  channel: ConversationChannel;
  status: string;
  category: string | null;
  urgency: ConversationUrgency;
  summary: string | null;
  created_at: string;
  updated_at: string;
  patient_name: string | null;
  message_count: number;
}

export interface MessageRead {
  id: string;
  conversation_id: string;
  sender: ChatSender;
  content: string;
  created_at: string;
}

export interface ConversationPatient {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  new_patient: boolean;
}

export interface ConversationDetail {
  id: string;
  clinic_id: string;
  patient_id: string | null;
  channel: ConversationChannel;
  status: string;
  category: string | null;
  urgency: ConversationUrgency;
  summary: string | null;
  created_at: string;
  updated_at: string;
  patient: ConversationPatient | null;
  messages: MessageRead[];
}

export interface Appointment {
  id: string;
  clinic_id: string;
  patient_id: string;
  provider_id: string;
  service_id: string;
  slot_id: string;
  status: AppointmentStatus;
  reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  patient_name: string;
  provider_name: string;
  service_name: string;
  start_time: string;
  end_time: string;
}

export interface AppointmentCreatePayload {
  patient_id: string;
  provider_id: string;
  service_id: string;
  slot_id: string;
  reason?: string | null;
  notes?: string | null;
}

export interface AppointmentSlot {
  id: string;
  clinic_id: string;
  provider_id: string;
  provider_name: string;
  start_time: string;
  end_time: string;
  is_booked: boolean;
  created_at: string;
}

export interface AppointmentSlotCreatePayload {
  provider_id: string;
  start_time: string;
  end_time: string;
}

export interface Patient {
  id: string;
  clinic_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  new_patient: boolean;
  created_at: string;
}

export interface PatientCreatePayload {
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  date_of_birth?: string | null;
  new_patient: boolean;
}

export type PatientUpdatePayload = Partial<PatientCreatePayload>;

export interface PatientListResponse {
  items: Patient[];
  total: number;
  page: number;
  page_size: number;
}

export interface PatientAppointment {
  id: string;
  service_name: string;
  provider_name: string;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  reason: string | null;
}

export interface PatientConversation {
  id: string;
  channel: ConversationChannel;
  urgency: ConversationUrgency;
  status: string;
  category: string | null;
  summary: string | null;
  created_at: string;
  message_count: number;
}

export interface PatientIntakeForm {
  id: string;
  reason_for_visit: string | null;
  insurance_provider: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  symptoms: string | null;
  ai_summary: string | null;
  missing_fields: string[];
  created_at: string;
}

export interface PatientDetail extends Patient {
  appointments: PatientAppointment[];
  conversations: PatientConversation[];
  intake_forms: PatientIntakeForm[];
}

export interface IntakeForm {
  id: string;
  patient_id: string | null;
  patient_name: string | null;
  conversation_id: string | null;
  reason_for_visit: string | null;
  insurance_provider: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  symptoms: string | null;
  ai_summary: string | null;
  missing_fields: string[];
  urgency: ConversationUrgency | null;
  created_at: string;
}
