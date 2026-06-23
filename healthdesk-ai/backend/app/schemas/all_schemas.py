from datetime import date, datetime, time
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


AppointmentStatus = Literal["scheduled", "rescheduled", "cancelled", "completed", "no_show"]
Channel = Literal["chat", "voice"]
MessageSender = Literal["user", "assistant", "staff", "system"]
Role = Literal["admin", "staff"]
Urgency = Literal["low", "medium", "high", "emergency"]


class HealthDeskModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ClinicBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    email: EmailStr | None = None
    address: str | None = None
    timezone: str = Field(default="America/Phoenix", max_length=64)
    opening_hours: dict[str, str] = Field(default_factory=dict)
    email_notifications_escalation: bool = True
    email_notifications_appointments: bool = True


class ClinicCreate(ClinicBase):
    pass


class ClinicUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    email: EmailStr | None = None
    address: str | None = None
    timezone: str | None = Field(default=None, max_length=64)
    opening_hours: dict[str, str] | None = None
    email_notifications_escalation: bool | None = None
    email_notifications_appointments: bool | None = None


class ClinicResponse(HealthDeskModel, ClinicBase):
    id: UUID
    created_at: datetime


class ClinicRead(ClinicResponse):
    pass


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    clinic_name: str = Field(min_length=1, max_length=255)
    role: Role = "staff"


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class GoogleAuthRequest(BaseModel):
    id_token: str = Field(min_length=1)


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)
    google_id: str | None = Field(default=None, max_length=255)
    role: str | None = Field(default=None, max_length=50)
    clinic_id: UUID | None = None


class UserResponse(HealthDeskModel):
    id: UUID
    name: str
    email: EmailStr
    role: str
    clinic_id: UUID | None
    created_at: datetime


class UserRead(UserResponse):
    google_id: str | None


class UserWithClinicResponse(UserResponse):
    clinic: ClinicResponse | None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class ProviderBase(BaseModel):
    clinic_id: UUID
    name: str = Field(min_length=1, max_length=255)
    specialty: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = None
    active: bool = True


class ProviderCreate(ProviderBase):
    pass


class ProviderUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    specialty: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = None
    active: bool | None = None


class ProviderRead(HealthDeskModel, ProviderBase):
    id: UUID
    created_at: datetime


class ServiceBase(BaseModel):
    clinic_id: UUID
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    duration_minutes: int = Field(default=30, ge=1, le=480)
    active: bool = True


class ServiceCreate(ServiceBase):
    pass


class ServiceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    duration_minutes: int | None = Field(default=None, ge=1, le=480)
    active: bool | None = None


class ServiceRead(HealthDeskModel, ServiceBase):
    id: UUID


class PatientBase(BaseModel):
    clinic_id: UUID
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=50)
    date_of_birth: date | None = None
    new_patient: bool = True


class PatientCreate(PatientBase):
    pass


class PatientUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=50)
    date_of_birth: date | None = None
    new_patient: bool | None = None


class PatientRead(HealthDeskModel, PatientBase):
    id: UUID
    created_at: datetime


class AppointmentSlotBase(BaseModel):
    clinic_id: UUID
    provider_id: UUID
    start_time: datetime
    end_time: datetime
    is_booked: bool = False


class AppointmentSlotCreate(AppointmentSlotBase):
    pass


class AppointmentSlotUpdate(BaseModel):
    start_time: datetime | None = None
    end_time: datetime | None = None
    is_booked: bool | None = None


class AppointmentSlotRead(HealthDeskModel, AppointmentSlotBase):
    id: UUID
    created_at: datetime


class AppointmentBase(BaseModel):
    clinic_id: UUID
    patient_id: UUID
    provider_id: UUID
    service_id: UUID
    slot_id: UUID
    status: AppointmentStatus = "scheduled"
    reason: str | None = None
    notes: str | None = None


class AppointmentCreate(AppointmentBase):
    pass


class AppointmentUpdate(BaseModel):
    patient_id: UUID | None = None
    provider_id: UUID | None = None
    service_id: UUID | None = None
    slot_id: UUID | None = None
    status: AppointmentStatus | None = None
    reason: str | None = None
    notes: str | None = None


class AppointmentRead(HealthDeskModel, AppointmentBase):
    id: UUID
    created_at: datetime
    updated_at: datetime


class ConversationBase(BaseModel):
    clinic_id: UUID
    patient_id: UUID | None = None
    channel: Channel
    status: str = Field(default="open", max_length=32)
    category: str | None = Field(default=None, max_length=100)
    urgency: Urgency = "low"
    summary: str | None = None


class ConversationCreate(ConversationBase):
    pass


class ConversationUpdate(BaseModel):
    patient_id: UUID | None = None
    channel: Channel | None = None
    status: str | None = Field(default=None, max_length=32)
    category: str | None = Field(default=None, max_length=100)
    urgency: Urgency | None = None
    summary: str | None = None


class ConversationRead(HealthDeskModel, ConversationBase):
    id: UUID
    created_at: datetime
    updated_at: datetime


class MessageBase(BaseModel):
    conversation_id: UUID
    sender: MessageSender
    content: str = Field(min_length=1)


class MessageCreate(MessageBase):
    pass


class MessageRead(HealthDeskModel, MessageBase):
    id: UUID
    created_at: datetime


class IntakeFormBase(BaseModel):
    clinic_id: UUID
    patient_id: UUID | None = None
    conversation_id: UUID | None = None
    reason_for_visit: str | None = None
    insurance_provider: str | None = Field(default=None, max_length=255)
    preferred_date: date | None = None
    preferred_time: time | None = None
    symptoms: str | None = None
    ai_summary: str | None = None
    missing_fields: list[str] = Field(default_factory=list)


class IntakeFormCreate(IntakeFormBase):
    pass


class IntakeFormUpdate(BaseModel):
    patient_id: UUID | None = None
    conversation_id: UUID | None = None
    reason_for_visit: str | None = None
    insurance_provider: str | None = Field(default=None, max_length=255)
    preferred_date: date | None = None
    preferred_time: time | None = None
    symptoms: str | None = None
    ai_summary: str | None = None
    missing_fields: list[str] | None = None


class IntakeFormRead(HealthDeskModel, IntakeFormBase):
    id: UUID
    created_at: datetime


class FAQBase(BaseModel):
    clinic_id: UUID
    question: str = Field(min_length=1)
    answer: str = Field(min_length=1)
    category: str | None = Field(default=None, max_length=100)
    active: bool = True


class FAQCreate(FAQBase):
    pass


class FAQUpdate(BaseModel):
    question: str | None = Field(default=None, min_length=1)
    answer: str | None = Field(default=None, min_length=1)
    category: str | None = Field(default=None, max_length=100)
    active: bool | None = None


class FAQRead(HealthDeskModel, FAQBase):
    id: UUID
    created_at: datetime


class EscalationBase(BaseModel):
    clinic_id: UUID
    conversation_id: UUID
    reason: str = Field(min_length=1)
    urgency: Urgency
    status: str = Field(default="open", max_length=32)


class EscalationCreate(EscalationBase):
    pass


class EscalationUpdate(BaseModel):
    reason: str | None = Field(default=None, min_length=1)
    urgency: Urgency | None = None
    status: str | None = Field(default=None, max_length=32)


class EscalationRead(HealthDeskModel, EscalationBase):
    id: UUID
    created_at: datetime


Intent = Literal[
    "book_appointment",
    "reschedule_appointment",
    "cancel_appointment",
    "clinic_faq",
    "insurance_question",
    "new_patient_intake",
    "urgent_escalation",
    "general_question",
    "unknown",
]


class AIChatRequest(BaseModel):
    conversation_id: UUID | None = None
    message: str = Field(min_length=1)
    clinic_id: UUID


class AIVoiceTranscriptRequest(BaseModel):
    conversation_id: UUID | None = None
    transcript: str = Field(min_length=1)
    clinic_id: UUID


class AISummarizeRequest(BaseModel):
    conversation_id: UUID


class AIClassifyIntentRequest(BaseModel):
    message: str = Field(min_length=1)


class AIExtractIntakeRequest(BaseModel):
    conversation_id: UUID


class AIChatResponse(BaseModel):
    conversation_id: UUID
    response: str
    intent: Intent
    urgency: Urgency
    needs_human: bool
    extracted_data: dict[str, Any] = Field(default_factory=dict)
    available_slots: list[dict[str, Any]] = Field(default_factory=list)
    patient_appointments: list[dict[str, Any]] = Field(default_factory=list)
    appointment: dict[str, Any] | None = None


class AppointmentLookupItem(BaseModel):
    id: UUID
    provider_name: str
    service_name: str
    date: str
    time: str
    status: AppointmentStatus


class AppointmentLookupResponse(BaseModel):
    found: bool
    patient_name: str | None = None
    appointments: list[AppointmentLookupItem] = Field(default_factory=list)


class PublicAppointmentRequest(BaseModel):
    clinic_id: UUID
    patient_name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    phone: str = Field(min_length=1, max_length=50)
    service: str = Field(min_length=1, max_length=255)
    preferred_date: date
    preferred_time: time | None = None
    reason: str | None = None
    new_patient: bool = True


class PublicAppointmentResponse(AIChatResponse):
    appointment: dict[str, Any] | None = None


class AISummaryResponse(BaseModel):
    summary: str


class AIIntentResponse(BaseModel):
    intent: Intent


class IntakeExtractionResponse(BaseModel):
    reason_for_visit: str | None = None
    insurance_provider: str | None = None
    preferred_date: str | None = None
    preferred_time: str | None = None
    symptoms: str | None = None


class ConversationStartRequest(BaseModel):
    channel: Channel
    patient_id: UUID | None = None


class StaffMessageRequest(BaseModel):
    content: str = Field(min_length=1)


class ConversationPatientResponse(BaseModel):
    id: UUID
    first_name: str
    last_name: str
    email: EmailStr | None = None
    phone: str | None = None
    new_patient: bool = True


class ConversationListItem(BaseModel):
    id: UUID
    channel: Channel
    status: str
    category: str | None
    urgency: Urgency
    summary: str | None
    created_at: datetime
    updated_at: datetime
    patient_name: str | None
    message_count: int


class ConversationDetailResponse(BaseModel):
    id: UUID
    clinic_id: UUID
    patient_id: UUID | None
    channel: Channel
    status: str
    category: str | None
    urgency: Urgency
    summary: str | None
    created_at: datetime
    updated_at: datetime
    patient: ConversationPatientResponse | None = None
    messages: list[MessageRead] = Field(default_factory=list)


class ProviderOptionResponse(BaseModel):
    id: UUID
    name: str
    specialty: str | None = None
    email: EmailStr | None = None
    active: bool


class ProviderCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    specialty: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = None


class ServiceOptionResponse(BaseModel):
    id: UUID
    name: str
    description: str | None = None
    duration_minutes: int
    active: bool


class ServiceCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    duration_minutes: int = Field(default=30, ge=1, le=480)


class FAQCreateRequest(BaseModel):
    question: str = Field(min_length=1)
    answer: str = Field(min_length=1)
    category: str | None = Field(default=None, max_length=100)
    active: bool = True


class FAQSettingsResponse(BaseModel):
    id: UUID
    question: str
    answer: str
    category: str | None = None
    active: bool
    created_at: datetime


class AppointmentCreateRequest(BaseModel):
    patient_id: UUID
    provider_id: UUID
    service_id: UUID
    slot_id: UUID
    reason: str | None = None
    notes: str | None = None


class AppointmentRescheduleRequest(BaseModel):
    new_slot_id: UUID


class AppointmentResponse(BaseModel):
    id: UUID
    clinic_id: UUID
    patient_id: UUID
    provider_id: UUID
    service_id: UUID
    slot_id: UUID
    status: AppointmentStatus
    reason: str | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime
    patient_name: str
    provider_name: str
    service_name: str
    start_time: datetime
    end_time: datetime


class AppointmentSlotCreateRequest(BaseModel):
    provider_id: UUID
    start_time: datetime
    end_time: datetime


class AppointmentSlotResponse(BaseModel):
    id: UUID
    clinic_id: UUID
    provider_id: UUID
    provider_name: str
    start_time: datetime
    end_time: datetime
    is_booked: bool
    created_at: datetime


class PatientCreateRequest(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=50)
    date_of_birth: date | None = None
    new_patient: bool = True


class PatientResponse(BaseModel):
    id: UUID
    clinic_id: UUID
    first_name: str
    last_name: str
    email: EmailStr | None = None
    phone: str | None = None
    date_of_birth: date | None = None
    new_patient: bool
    created_at: datetime


class PatientListResponse(BaseModel):
    items: list[PatientResponse]
    total: int
    page: int
    page_size: int


class PatientAppointmentResponse(BaseModel):
    id: UUID
    service_name: str
    provider_name: str
    start_time: datetime
    end_time: datetime
    status: AppointmentStatus
    reason: str | None = None


class PatientConversationResponse(BaseModel):
    id: UUID
    channel: Channel
    urgency: Urgency
    status: str
    category: str | None = None
    summary: str | None = None
    created_at: datetime
    message_count: int


class PatientIntakeFormResponse(BaseModel):
    id: UUID
    reason_for_visit: str | None = None
    insurance_provider: str | None = None
    preferred_date: date | None = None
    preferred_time: time | None = None
    symptoms: str | None = None
    ai_summary: str | None = None
    missing_fields: list[str] = Field(default_factory=list)
    created_at: datetime


class PatientDetailResponse(PatientResponse):
    appointments: list[PatientAppointmentResponse] = Field(default_factory=list)
    conversations: list[PatientConversationResponse] = Field(default_factory=list)
    intake_forms: list[PatientIntakeFormResponse] = Field(default_factory=list)


class AnalyticsOverviewResponse(BaseModel):
    total_conversations: int
    booked_appointments: int
    rescheduled_appointments: int
    cancelled_appointments: int
    open_escalations: int
    pending_intake_forms: int
    booking_conversion_rate: float


class InquiriesByDayItem(BaseModel):
    date: str
    count: int


class AppointmentStatusCountItem(BaseModel):
    status: AppointmentStatus
    count: int


class CommonQuestionItem(BaseModel):
    category: str
    count: int


class PeakHourItem(BaseModel):
    hour: int
    count: int


class IntakeFormListItem(BaseModel):
    id: UUID
    patient_id: UUID | None = None
    patient_name: str | None = None
    conversation_id: UUID | None = None
    reason_for_visit: str | None = None
    insurance_provider: str | None = None
    preferred_date: date | None = None
    preferred_time: time | None = None
    symptoms: str | None = None
    ai_summary: str | None = None
    missing_fields: list[str] = Field(default_factory=list)
    urgency: Urgency | None = None
    created_at: datetime
