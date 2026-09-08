from __future__ import annotations

import asyncio
from datetime import date, datetime, time, timedelta, timezone
import re
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.rate_limit import limiter
from app.models.all_models import (
    Appointment,
    AppointmentSlot,
    Clinic,
    Conversation,
    Escalation,
    FAQ,
    IntakeForm,
    Message,
    Patient,
    Provider,
    Service,
    User,
)
from app.schemas.all_schemas import (
    AIChatRequest,
    AIChatResponse,
    AIClassifyIntentRequest,
    AIExtractIntakeRequest,
    AIIntentResponse,
    AISummarizeRequest,
    AISummaryResponse,
    AIVoiceTranscriptRequest,
    IntakeExtractionResponse,
    PublicAppointmentRequest,
    PublicAppointmentResponse,
)
from app.services import ai_service, appointment_service
from app.services.ai_service import AIServiceError
from app.services.appointment_lookup_service import lookup_upcoming_appointments
from app.services.email_service import send_escalation_alert
from app.services.safety_service import SAFE_ESCALATION_RESPONSE, check_escalation


router = APIRouter(prefix="/ai", tags=["ai"])


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _get_clinic(db: Session, clinic_id: UUID) -> Clinic:
    clinic = db.execute(select(Clinic).where(Clinic.id == clinic_id)).scalars().first()
    if clinic is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clinic not found")
    return clinic


def _get_conversation(db: Session, conversation_id: UUID, clinic_id: UUID | None = None) -> Conversation:
    query = select(Conversation).where(Conversation.id == conversation_id)
    if clinic_id is not None:
        query = query.where(Conversation.clinic_id == clinic_id)
    conversation = db.execute(query).scalars().first()
    if conversation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )
    return conversation


def _get_or_create_conversation(
    db: Session,
    clinic_id: UUID,
    conversation_id: UUID | None,
    channel: str,
) -> Conversation:
    if conversation_id is not None:
        return _get_conversation(db, conversation_id, clinic_id)

    conversation = Conversation(
        clinic_id=clinic_id,
        channel=channel,
        status="open",
        urgency="low",
    )
    db.add(conversation)
    db.flush()
    return conversation


def _load_messages(db: Session, conversation_id: UUID) -> list[Message]:
    return (
        db.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at, Message.id)
        )
        .scalars()
        .all()
    )


def _clinic_context(db: Session, clinic: Clinic) -> dict[str, Any]:
    faqs = (
        db.execute(
            select(FAQ)
            .where(FAQ.clinic_id == clinic.id, FAQ.active.is_(True))
            .order_by(FAQ.category, FAQ.question)
        )
        .scalars()
        .all()
    )
    providers = (
        db.execute(
            select(Provider)
            .where(Provider.clinic_id == clinic.id, Provider.active.is_(True))
            .order_by(Provider.name)
        )
        .scalars()
        .all()
    )
    services = (
        db.execute(
            select(Service)
            .where(Service.clinic_id == clinic.id, Service.active.is_(True))
            .order_by(Service.name)
        )
        .scalars()
        .all()
    )
    return {
        "clinic": {
            "id": clinic.id,
            "name": clinic.name,
            "phone": clinic.phone,
            "email": clinic.email,
            "address": clinic.address,
            "timezone": clinic.timezone,
            "opening_hours": clinic.opening_hours,
        },
        "faqs": [
            {"question": faq.question, "answer": faq.answer, "category": faq.category}
            for faq in faqs
        ],
        "providers": [
            {
                "id": provider.id,
                "name": provider.name,
                "specialty": provider.specialty,
                "email": provider.email,
            }
            for provider in providers
        ],
        "services": [
            {
                "id": service.id,
                "name": service.name,
                "description": service.description,
                "duration_minutes": service.duration_minutes,
            }
            for service in services
        ],
    }


def _normalize_ai_result(result: dict[str, Any]) -> dict[str, Any]:
    return {
        "intent": result.get("intent") or "unknown",
        "response": result.get("response") or "",
        "urgency": result.get("urgency") or "low",
        "needs_human": bool(result.get("needs_human", False)),
        "extracted_data": result.get("extracted_data") if isinstance(result.get("extracted_data"), dict) else {},
    }


def _parse_date(value: Any) -> date | None:
    if value is None:
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    try:
        return date.fromisoformat(str(value).strip())
    except ValueError:
        return None


def _parse_time(value: Any) -> time | None:
    if value is None:
        return None
    if isinstance(value, time):
        return value
    text = str(value).strip()
    for candidate in (text, f"{text}:00" if text.count(":") == 1 else text):
        try:
            return time.fromisoformat(candidate)
        except ValueError:
            continue
    return None


def _find_service(db: Session, clinic_id: UUID, extracted_data: dict[str, Any]) -> Service | None:
    service_id = extracted_data.get("service_id")
    if service_id:
        try:
            service_uuid = UUID(str(service_id))
        except ValueError:
            service_uuid = None
        if service_uuid is not None:
            service = db.execute(
                select(Service).where(
                    Service.id == service_uuid,
                    Service.clinic_id == clinic_id,
                    Service.active.is_(True),
                )
            ).scalars().first()
            if service is not None:
                return service

    service_name = (
        extracted_data.get("service")
        or extracted_data.get("service_name")
        or extracted_data.get("requested_service")
    )
    if not service_name:
        return None

    return (
        db.execute(
            select(Service)
            .where(
                Service.clinic_id == clinic_id,
                Service.active.is_(True),
                Service.name.ilike(f"%{str(service_name).strip()}%"),
            )
            .order_by(Service.name)
        )
        .scalars()
        .first()
    )


async def _available_slots_for_booking(
    db: Session,
    clinic_id: UUID,
    extracted_data: dict[str, Any],
) -> list[dict[str, Any]]:
    service = _find_service(db, clinic_id, extracted_data)
    requested_date = _parse_date(
        extracted_data.get("date")
        or extracted_data.get("preferred_date")
        or extracted_data.get("appointment_date")
    )
    if service is None or requested_date is None:
        return []

    return await appointment_service.get_available_slots(
        db=db,
        clinic_id=clinic_id,
        service_id=service.id,
        date_from=requested_date,
        date_to=requested_date,
    )


def _normalize_search_text(value: str) -> str:
    return "".join(character.lower() for character in value if character.isalnum())


def _find_public_service(db: Session, clinic_id: UUID, requested_service: str) -> Service | None:
    services = (
        db.execute(
            select(Service)
            .where(Service.clinic_id == clinic_id, Service.active.is_(True))
            .order_by(Service.name)
        )
        .scalars()
        .all()
    )
    if not services:
        return None

    requested = _normalize_search_text(requested_service)
    for service in services:
        service_name = _normalize_search_text(service.name)
        service_description = _normalize_search_text(service.description or "")
        if requested and (requested in service_name or service_name in requested or requested in service_description):
            return service

    requested_words = {
        _normalize_search_text(word)
        for word in requested_service.split()
        if len(_normalize_search_text(word)) >= 3
    }
    for service in services:
        service_words = {
            _normalize_search_text(word)
            for word in service.name.split()
            if len(_normalize_search_text(word)) >= 3
        }
        if requested_words & service_words:
            return service

    return services[0]


def _clinic_timezone(clinic: Clinic) -> ZoneInfo:
    try:
        return ZoneInfo(clinic.timezone or "America/Phoenix")
    except Exception:
        return ZoneInfo("America/Phoenix")


def _slots_for_public_request(
    db: Session,
    clinic: Clinic,
    preferred_date: date,
    preferred_time: time | None,
) -> list[AppointmentSlot]:
    clinic_tz = _clinic_timezone(clinic)
    day_start = datetime.combine(preferred_date, time.min, tzinfo=clinic_tz)
    day_end = datetime.combine(preferred_date, time.max, tzinfo=clinic_tz)
    slot_has_active_appointment = (
        select(Appointment.id)
        .where(Appointment.slot_id == AppointmentSlot.id)
        .exists()
    )
    query = (
        select(AppointmentSlot)
        .join(Provider, AppointmentSlot.provider_id == Provider.id)
        .where(
            AppointmentSlot.clinic_id == clinic.id,
            AppointmentSlot.is_booked.is_(False),
            ~slot_has_active_appointment,
            AppointmentSlot.start_time >= day_start,
            AppointmentSlot.start_time <= day_end,
            Provider.active.is_(True),
        )
        .order_by(AppointmentSlot.start_time)
    )
    same_day_slots = db.execute(query).scalars().all()
    if same_day_slots:
        if preferred_time is None:
            return same_day_slots
        target = datetime.combine(preferred_date, preferred_time, tzinfo=clinic_tz)
        return sorted(
            same_day_slots,
            key=lambda slot: abs((slot.start_time.astimezone(clinic_tz) - target).total_seconds()),
        )

    next_slots_query = (
        select(AppointmentSlot)
        .join(Provider, AppointmentSlot.provider_id == Provider.id)
        .where(
            AppointmentSlot.clinic_id == clinic.id,
            AppointmentSlot.is_booked.is_(False),
            ~slot_has_active_appointment,
            AppointmentSlot.start_time >= day_start,
            Provider.active.is_(True),
        )
        .order_by(AppointmentSlot.start_time)
        .limit(10)
    )
    return db.execute(next_slots_query).scalars().all()


def _exclude_taken_slots(db: Session, slots: list[AppointmentSlot]) -> list[AppointmentSlot]:
    available_slots: list[AppointmentSlot] = []
    for slot in slots:
        existing_appointment = db.execute(
            select(Appointment.id).where(
                Appointment.slot_id == slot.id,
            )
        ).scalar_one_or_none()
        if existing_appointment is None:
            available_slots.append(slot)
        elif not slot.is_booked:
            slot.is_booked = True
            db.add(slot)
    return available_slots


def _format_slot(slot: AppointmentSlot, clinic: Clinic) -> str:
    clinic_tz = _clinic_timezone(clinic)
    local_start = slot.start_time.astimezone(clinic_tz)
    formatted = local_start.strftime("%A, %B %d at %I:%M %p %Z")
    return formatted.replace(" 0", " ")


# Words that merely name the booking topic. On their own they do not mean the
# patient wants to schedule: "where do I park when I visit?" is an FAQ.
BOOKING_TOPIC_RE = re.compile(
    r"\b(?:appointments?|slots?|visits?|checkups?|check-ups?"
    r"|follow[\s-]?ups?|consultations?|physicals?)\b",
    re.IGNORECASE,
)

# Phrases that signal a scheduling request on their own.
BOOKING_ACTION_RE = re.compile(
    r"\b(?:book|booking|schedule|scheduling|reschedule|rebook"
    r"|availabilit(?:y|ies)|openings?|slots?)\b"
    r"|\b(?:come\s+in|be\s+seen|get\s+in|fit\s+me\s+in"
    r"|squeeze\s+me\s+in|sign\s+me\s+up)\b",
    re.IGNORECASE,
)

# Softer scheduling verbs, which only count when they sit directly beside a
# booking topic, so "do I need a referral for a consultation?" stays an FAQ.
BOOKING_VERB_TOPIC_RE = re.compile(
    r"\b(?:make|set\s?up|arrange|reserve|need|want|get|take|find)\s+"
    r"(?:an?|the|my|another|new|next)?\s*"
    r"(?:new|first|another|next|early|late|morning|afternoon)?\s*"
    r"(?:appointments?|slots?|visits?|checkups?|check-ups?"
    r"|follow[\s-]?ups?|consultations?|physicals?)\b",
    re.IGNORECASE,
)

# "next available appointment", "what times are available" and similar, in
# either word order, without matching "are lab results available online?".
BOOKING_AVAILABILITY_RE = re.compile(
    r"\b(?:available|free|open|earliest|soonest|next)\b[^.?!]{0,30}?"
    r"\b(?:appointments?|slots?|visits?|checkups?|consultations?"
    r"|times?|dates?|openings?)\b"
    r"|\b(?:appointments?|slots?|visits?|checkups?|consultations?|times?|dates?)\b"
    r"[^.?!]{0,30}?\b(?:available|availability|open|free)\b",
    re.IGNORECASE,
)
UUID_RE = re.compile(
    r"\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b",
    re.IGNORECASE,
)
EMAIL_RE = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
PHONE_RE = re.compile(r"(?:\+?\d[\d\s().-]{6,}\d)")
APPOINTMENT_LOOKUP_PHRASES = (
    "my appointment",
    "upcoming appointment",
    "upcoming appointments",
    "when is my appointment",
    "when are my appointments",
    "check my appointment",
    "check my appointments",
    "look up my appointment",
    "look up my appointments",
    "find my appointment",
    "find my appointments",
    "do i have an appointment",
    "appointment time",
    "reschedule",
)
APPOINTMENT_LOOKUP_CONTEXT_WORDS = (
    "my",
    "upcom",
    "when",
    "check",
    "lookup",
    "look",
    "find",
    "show",
    "view",
    "email",
    "resched",
)
RESCHEDULE_CONTEXT_WORDS = (
    "reschedule",
    "rescheduled",
    "rescheduling",
    "move appointment",
    "move my appointment",
    "change appointment",
    "change my appointment",
    "change the appointment",
    "change appointment date",
    "change appointment time",
    "change date",
    "change time",
    "different time",
    "different date",
)


def _slot_payload(slot: AppointmentSlot) -> dict[str, Any]:
    return {
        "id": str(slot.id),
        "provider_id": str(slot.provider_id),
        "provider_name": slot.provider.name if slot.provider else None,
        "start_time": slot.start_time.isoformat(),
        "end_time": slot.end_time.isoformat(),
    }


def _active_services(db: Session, clinic_id: UUID) -> list[Service]:
    return (
        db.execute(
            select(Service)
            .where(Service.clinic_id == clinic_id, Service.active.is_(True))
            .order_by(Service.name)
        )
        .scalars()
        .all()
    )


def _match_service_from_text(db: Session, clinic_id: UUID, text: str) -> Service | None:
    normalized_text = _normalize_search_text(text)
    if not normalized_text:
        return None

    services = _active_services(db, clinic_id)
    for service in services:
        service_name = _normalize_search_text(service.name)
        service_description = _normalize_search_text(service.description or "")
        if service_name and (
            service_name in normalized_text
            or normalized_text in service_name
            or service_name in service_description
        ):
            return service

    text_words = {
        _normalize_search_text(word)
        for word in text.split()
        if len(_normalize_search_text(word)) >= 4
    }
    for service in services:
        service_words = {
            _normalize_search_text(word)
            for word in service.name.split()
            if len(_normalize_search_text(word)) >= 4
        }
        if text_words & service_words:
            return service
    return None


def _extract_patient_details(user_text: str) -> dict[str, Any]:
    email_match = EMAIL_RE.search(user_text)
    phone = None
    for phone_match in PHONE_RE.finditer(user_text):
        digits = re.sub(r"\D", "", phone_match.group(0))
        if len(digits) >= 10:
            phone = phone_match.group(0).strip()
            break

    name = None
    name_patterns = [
        r"\bmy name is\s+([A-Za-z][A-Za-z\s.'-]{1,80})",
        r"\bname is\s+([A-Za-z][A-Za-z\s.'-]{1,80})",
        r"\bi am\s+([A-Za-z][A-Za-z\s.'-]{1,80})",
        r"\bi'm\s+([A-Za-z][A-Za-z\s.'-]{1,80})",
        r"\bthis is\s+([A-Za-z][A-Za-z\s.'-]{1,80})",
    ]
    for pattern in name_patterns:
        match = re.search(pattern, user_text, re.IGNORECASE)
        if match:
            candidate = re.split(
                r"\b(?:phone|email|visit|service|appointment|for|and)\b",
                match.group(1).strip(),
                maxsplit=1,
                flags=re.IGNORECASE,
            )[0].strip(" ,.-")
            if candidate and "patient" not in candidate.lower():
                name = " ".join(part.capitalize() for part in candidate.split())
                break

    if name is None and phone:
        for line in user_text.splitlines():
            if phone not in line:
                continue
            before_phone = line.split(phone, 1)[0]
            before_phone = re.sub(r"\b(?:phone|number|mobile|cell|is|:)\b", " ", before_phone, flags=re.IGNORECASE)
            candidate = before_phone.strip(" ,.-")
            if 2 <= len(candidate.split()) <= 4 and all(part.replace("-", "").replace("'", "").isalpha() for part in candidate.split()):
                name = " ".join(part.capitalize() for part in candidate.split())
                break

    return {
        "patient_name": name,
        "email": email_match.group(0).lower() if email_match else None,
        "phone": phone,
    }


def _is_appointment_lookup_request(conversation: Conversation, text: str, messages: list[Message]) -> bool:
    lowered = text.lower()
    normalized = _normalize_search_text(text)
    explicit_lookup = any(phrase in lowered for phrase in APPOINTMENT_LOOKUP_PHRASES)
    contextual_lookup = "appoin" in normalized and any(
        word in normalized for word in APPOINTMENT_LOOKUP_CONTEXT_WORDS
    )
    if conversation.category == "appointment_lookup":
        return True
    if explicit_lookup:
        return True
    if contextual_lookup:
        return True
    if conversation.category in {"book_appointment", "reschedule_appointment"}:
        return False
    if EMAIL_RE.search(text):
        return any(
            message.sender == "assistant"
            and (
                "share your email" in message.content.lower()
                or "email address" in message.content.lower()
            )
            for message in messages[-4:]
        )
    return False


def _is_reschedule_request(conversation: Conversation, text: str) -> bool:
    lowered = text.lower()
    normalized = _normalize_search_text(text)
    explicit_request = any(phrase in lowered for phrase in RESCHEDULE_CONTEXT_WORDS) or (
        "resched" in normalized or ("change" in normalized and "appoin" in normalized)
    )
    if conversation.category == "reschedule_appointment":
        return conversation.status != "closed" or explicit_request
    return explicit_request


def _find_reschedule_target(
    db: Session,
    clinic: Clinic,
    email: str,
) -> tuple[Appointment, AppointmentSlot, Service] | None:
    row = (
        db.execute(
            select(Appointment, AppointmentSlot, Service)
            .join(Patient, Appointment.patient_id == Patient.id)
            .join(AppointmentSlot, Appointment.slot_id == AppointmentSlot.id)
            .join(Service, Appointment.service_id == Service.id)
            .where(
                Appointment.clinic_id == clinic.id,
                Patient.email.ilike(email.strip().lower()),
                Appointment.status.in_(("scheduled", "rescheduled")),
                AppointmentSlot.start_time >= datetime.now(timezone.utc),
            )
            .order_by(AppointmentSlot.start_time.asc())
            .limit(1)
        )
        .first()
    )
    if row is None:
        return None
    appointment, slot, service = row
    return appointment, slot, service


def _handle_reschedule_chat(
    db: Session,
    clinic: Clinic,
    conversation: Conversation,
    messages: list[Message],
    latest_message: str,
) -> AIChatResponse | None:
    if not _is_reschedule_request(conversation, latest_message):
        return None

    user_messages = [message.content for message in messages if message.sender == "user"]
    combined_user_text = "\n".join(user_messages)
    email_match = EMAIL_RE.search(latest_message) or EMAIL_RE.search(combined_user_text)
    conversation.category = "reschedule_appointment"
    conversation.urgency = "low"
    conversation.updated_at = utc_now()

    if email_match is None:
        response_text = (
            "I can help reschedule an upcoming appointment. "
            "Please share the email address used for the booking so I can find it."
        )
        _save_assistant_message(db, conversation, response_text, "reschedule_appointment", "low")
        return AIChatResponse(
            conversation_id=conversation.id,
            response=response_text,
            intent="reschedule_appointment",
            urgency="low",
            needs_human=False,
            extracted_data={"needs_email": True, "reschedule": True},
            available_slots=[],
            patient_appointments=[],
        )

    email = email_match.group(0).lower()
    target = _find_reschedule_target(db, clinic, email)
    lookup_result = lookup_upcoming_appointments(db, clinic.id, email, clinic.timezone)
    if target is None:
        response_text = (
            "I could not find an upcoming scheduled appointment for that email address. "
            "Please check the email spelling or contact the clinic if the appointment was booked another way."
        )
        _save_assistant_message(db, conversation, response_text, "reschedule_appointment", "low")
        return AIChatResponse(
            conversation_id=conversation.id,
            response=response_text,
            intent="reschedule_appointment",
            urgency="low",
            needs_human=True,
            extracted_data={"patient_email": email, "reschedule": True},
            available_slots=[],
            patient_appointments=[],
        )

    appointment, current_slot, service = target
    requested_date = _parse_requested_date(latest_message, clinic) or _parse_requested_date(combined_user_text, clinic)
    requested_time = _parse_requested_time(latest_message) or _parse_requested_time(combined_user_text)
    selected_slot_id = _selected_slot_id_from_text(latest_message)

    if selected_slot_id is None:
        slots = _available_public_slots(db, clinic, requested_date, requested_time)
        if not slots and (requested_date is not None or requested_time is not None):
            slots = _available_public_slots(db, clinic, None, None)

        if not slots:
            response_text = (
                f"I found your current appointment on {_format_slot(current_slot, clinic)}, "
                "but I do not see any open slots to reschedule into right now. "
                "Please call the clinic for help with this change."
            )
            _save_assistant_message(db, conversation, response_text, "reschedule_appointment", "low")
            return AIChatResponse(
                conversation_id=conversation.id,
                response=response_text,
                intent="reschedule_appointment",
                urgency="low",
                needs_human=True,
                extracted_data={"patient_email": email, "appointment_id": str(appointment.id)},
                available_slots=[],
                patient_appointments=lookup_result["appointments"],
            )

        requested_text = (
            f" matching {requested_date.isoformat()}"
            if requested_date
            else ""
        )
        response_text = (
            f"I found your current {service.name} appointment on {_format_slot(current_slot, clinic)}. "
            f"Here are open times{requested_text} for rescheduling. Choose one of these times and I will update the appointment."
        )
        _save_assistant_message(db, conversation, response_text, "reschedule_appointment", "low")
        return AIChatResponse(
            conversation_id=conversation.id,
            response=response_text,
            intent="reschedule_appointment",
            urgency="low",
            needs_human=False,
            extracted_data={
                "patient_email": email,
                "appointment_id": str(appointment.id),
                "current_slot_id": str(current_slot.id),
                "reschedule": True,
            },
            available_slots=[_slot_payload(slot) for slot in slots],
            patient_appointments=lookup_result["appointments"],
        )

    selected_slot = (
        db.execute(
            select(AppointmentSlot)
            .join(Provider, AppointmentSlot.provider_id == Provider.id)
            .where(
                AppointmentSlot.id == selected_slot_id,
                AppointmentSlot.clinic_id == clinic.id,
                AppointmentSlot.is_booked.is_(False),
                Provider.active.is_(True),
                ~select(Appointment.id)
                .where(Appointment.slot_id == AppointmentSlot.id)
                .exists(),
            )
        )
        .scalars()
        .first()
    )
    if selected_slot is None:
        slots = _available_public_slots(db, clinic, requested_date, requested_time)
        response_text = (
            "That time is no longer available. Please choose one of these current open times."
            if slots
            else "That time is no longer available, and I do not see another open slot right now."
        )
        _save_assistant_message(db, conversation, response_text, "reschedule_appointment", "low")
        return AIChatResponse(
            conversation_id=conversation.id,
            response=response_text,
            intent="reschedule_appointment",
            urgency="low",
            needs_human=not bool(slots),
            extracted_data={"patient_email": email, "appointment_id": str(appointment.id)},
            available_slots=[_slot_payload(slot) for slot in slots],
            patient_appointments=lookup_result["appointments"],
        )

    current_slot.is_booked = False
    selected_slot.is_booked = True
    appointment.slot_id = selected_slot.id
    appointment.provider_id = selected_slot.provider_id
    appointment.status = "rescheduled"
    appointment.updated_at = utc_now()
    appointment.reminder_email_sent_at = None
    conversation.patient_id = appointment.patient_id
    conversation.status = "closed"
    response_text = (
        f"Your appointment has been rescheduled to {_format_slot(selected_slot, clinic)} "
        f"with {selected_slot.provider.name} for {service.name}. "
        "The clinic staff dashboard has been updated."
    )
    conversation.summary = response_text
    db.add(current_slot)
    db.add(selected_slot)
    db.add(appointment)
    _save_assistant_message(db, conversation, response_text, "reschedule_appointment", "low")
    db.add(conversation)
    return AIChatResponse(
        conversation_id=conversation.id,
        response=response_text,
        intent="reschedule_appointment",
        urgency="low",
        needs_human=False,
        extracted_data={
            "patient_email": email,
            "appointment_id": str(appointment.id),
            "old_slot_id": str(current_slot.id),
            "new_slot_id": str(selected_slot.id),
            "reschedule": True,
        },
        available_slots=[],
        patient_appointments=[],
        appointment=_appointment_payload(appointment, selected_slot, service),
    )


def _lookup_response_text(result: dict[str, Any], email: str) -> str:
    if not result["found"]:
        return (
            "I could not find upcoming scheduled appointments for that email address. "
            "Please check the spelling or contact the clinic if you booked another way."
        )
    if not result["appointments"]:
        return (
            f"I found {result['patient_name']}, but there are no upcoming scheduled appointments "
            "for that email address right now."
        )
    count = len(result["appointments"])
    plural = "appointments" if count != 1 else "appointment"
    return f"I found {count} upcoming {plural} for {result['patient_name']} using {email}."


def _handle_appointment_lookup_chat(
    db: Session,
    clinic: Clinic,
    conversation: Conversation,
    messages: list[Message],
    latest_message: str,
) -> AIChatResponse | None:
    if not _is_appointment_lookup_request(conversation, latest_message, messages):
        return None

    combined_user_text = "\n".join(message.content for message in messages if message.sender == "user")
    email_match = EMAIL_RE.search(latest_message) or EMAIL_RE.search(combined_user_text)
    conversation.category = "appointment_lookup"
    conversation.urgency = "low"
    conversation.updated_at = utc_now()

    if email_match is None:
        response_text = (
            "I can look up upcoming scheduled appointments for this clinic. "
            "Could you share your email address?"
        )
        _save_assistant_message(db, conversation, response_text, "reschedule_appointment", "low")
        return AIChatResponse(
            conversation_id=conversation.id,
            response=response_text,
            intent="reschedule_appointment",
            urgency="low",
            needs_human=False,
            extracted_data={"needs_email": True},
            available_slots=[],
            patient_appointments=[],
        )

    email = email_match.group(0).lower()
    result = lookup_upcoming_appointments(db, clinic.id, email, clinic.timezone)
    response_text = _lookup_response_text(result, email)
    _save_assistant_message(db, conversation, response_text, "reschedule_appointment", "low")
    return AIChatResponse(
        conversation_id=conversation.id,
        response=response_text,
        intent="reschedule_appointment",
        urgency="low",
        needs_human=False,
        extracted_data={"patient_email": email},
        available_slots=[],
        patient_appointments=result["appointments"],
    )


def _parse_requested_date(text: str, clinic: Clinic) -> date | None:
    lowered = text.lower()
    today = datetime.now(_clinic_timezone(clinic)).date()
    if "tomorrow" in lowered:
        return today + timedelta(days=1)
    if "today" in lowered:
        return today

    iso_match = re.search(r"\b(\d{4})-(\d{1,2})-(\d{1,2})\b", text)
    if iso_match:
        year, month, day = (int(part) for part in iso_match.groups())
        try:
            return date(year, month, day)
        except ValueError:
            return None

    numeric_match = re.search(r"\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b", text)
    if numeric_match:
        first, second, year_text = numeric_match.groups()
        year = int(year_text) if year_text else today.year
        if year < 100:
            year += 2000
        first_num = int(first)
        second_num = int(second)
        month, day = (first_num, second_num)
        if first_num > 12 and second_num <= 12:
            day, month = first_num, second_num
        try:
            parsed = date(year, month, day)
            if parsed < today and not year_text:
                parsed = date(year + 1, month, day)
            return parsed
        except ValueError:
            return None

    for pattern in ("%B %d", "%b %d"):
        for match in re.finditer(r"\b([A-Za-z]{3,9})\s+(\d{1,2})\b", text):
            try:
                parsed_dt = datetime.strptime(match.group(0), pattern)
            except ValueError:
                continue
            parsed = date(today.year, parsed_dt.month, parsed_dt.day)
            if parsed < today:
                parsed = date(today.year + 1, parsed_dt.month, parsed_dt.day)
            return parsed
    return None


def _parse_requested_time(text: str) -> time | None:
    am_pm_match = re.search(r"\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b", text, re.IGNORECASE)
    if am_pm_match:
        hour = int(am_pm_match.group(1))
        minute = int(am_pm_match.group(2) or 0)
        marker = am_pm_match.group(3).lower()
        if marker == "pm" and hour != 12:
            hour += 12
        if marker == "am" and hour == 12:
            hour = 0
        try:
            return time(hour, minute)
        except ValueError:
            return None

    twenty_four_hour_match = re.search(r"\b([01]?\d|2[0-3]):([0-5]\d)\b", text)
    if twenty_four_hour_match:
        try:
            return time(int(twenty_four_hour_match.group(1)), int(twenty_four_hour_match.group(2)))
        except ValueError:
            return None
    return None


def _requests_broad_availability(text: str) -> bool:
    lowered = text.lower()
    return any(
        phrase in lowered
        for phrase in (
            "full week",
            "whole week",
            "this week",
            "next week",
            "available slots",
            "all slots",
            "all available",
            "show me slots",
            "what times",
            "what dates",
        )
    )


def _available_public_slots(
    db: Session,
    clinic: Clinic,
    requested_date: date | None,
    requested_time: time | None,
    limit: int = 8,
) -> list[AppointmentSlot]:
    clinic_tz = _clinic_timezone(clinic)
    now = datetime.now(timezone.utc)
    slot_has_appointment = (
        select(Appointment.id)
        .where(Appointment.slot_id == AppointmentSlot.id)
        .exists()
    )
    query = (
        select(AppointmentSlot)
        .join(Provider, AppointmentSlot.provider_id == Provider.id)
        .where(
            AppointmentSlot.clinic_id == clinic.id,
            AppointmentSlot.is_booked.is_(False),
            ~slot_has_appointment,
            AppointmentSlot.start_time >= now,
            Provider.active.is_(True),
        )
        .order_by(AppointmentSlot.start_time)
        .limit(25)
    )
    if requested_date is not None:
        day_start = datetime.combine(requested_date, time.min, tzinfo=clinic_tz)
        day_end = datetime.combine(requested_date, time.max, tzinfo=clinic_tz)
        query = query.where(
            AppointmentSlot.start_time >= day_start,
            AppointmentSlot.start_time <= day_end,
        )

    slots = db.execute(query).scalars().all()
    slots = _exclude_taken_slots(db, slots)
    if requested_time is not None:
        target_date = requested_date or datetime.now(clinic_tz).date()
        target = datetime.combine(target_date, requested_time, tzinfo=clinic_tz)
        slots = sorted(
            slots,
            key=lambda slot: abs((slot.start_time.astimezone(clinic_tz) - target).total_seconds()),
        )
    return slots[:limit]


def _selected_slot_id_from_messages(messages: list[Message]) -> UUID | None:
    for message in reversed(messages):
        if message.sender != "user":
            continue
        matches = UUID_RE.findall(message.content)
        if matches:
            return UUID(matches[-1])
    return None


def _selected_slot_id_from_text(text: str) -> UUID | None:
    matches = UUID_RE.findall(text)
    if not matches:
        return None
    return UUID(matches[-1])


def _looks_like_booking_request(text: str) -> bool:
    return bool(
        BOOKING_ACTION_RE.search(text)
        or BOOKING_VERB_TOPIC_RE.search(text)
        or BOOKING_AVAILABILITY_RE.search(text)
        or _requests_broad_availability(text)
    )


def _is_booking_continuation(
    conversation: Conversation, latest_message: str, messages: list[Message]
) -> bool:
    """True when the live thread is a booking and this message answers it.

    The booking flow asks for a slot, name, email, phone and visit type, so those
    replies must stay in the flow even though they carry no scheduling verb.
    _save_assistant_message rewrites the category on every other kind of turn, so
    this only holds while booking is genuinely the open question.
    """
    if conversation.category != "book_appointment":
        return False
    if _selected_slot_id_from_messages(messages):
        return True
    return bool(
        EMAIL_RE.search(latest_message)
        or PHONE_RE.search(latest_message)
        or BOOKING_TOPIC_RE.search(latest_message)
    )


def _is_booking_related(conversation: Conversation, latest_message: str, messages: list[Message]) -> bool:
    if conversation.status == "closed":
        return _looks_like_booking_request(latest_message)
    if UUID_RE.search(latest_message):
        return True
    if _is_booking_continuation(conversation, latest_message, messages):
        return True
    return _looks_like_booking_request(latest_message)


def _is_courtesy_message(message: str) -> bool:
    normalized = re.sub(r"[^a-z\s]", " ", message.lower())
    normalized = " ".join(normalized.split())
    courtesy_phrases = (
        "thanks",
        "thank you",
        "thank you for help",
        "thank you for your help",
        "ok thanks",
        "okay thanks",
        "okay thank you",
        "appreciate it",
        "that helps",
    )
    return any(phrase in normalized for phrase in courtesy_phrases)


def _has_completed_booking(conversation: Conversation, messages: list[Message]) -> bool:
    if conversation.status == "closed" and conversation.category in {"book_appointment", "reschedule_appointment"}:
        return True
    return any(
        message.sender == "assistant"
        and (
            "appointment is booked" in message.content.lower()
            or "appointment is confirmed" in message.content.lower()
            or "appointment has been rescheduled" in message.content.lower()
            or "has been rescheduled" in message.content.lower()
        )
        for message in messages
    )


def _handle_courtesy_after_booking(
    db: Session,
    conversation: Conversation,
    messages: list[Message],
    latest_message: str,
) -> AIChatResponse | None:
    if not _is_courtesy_message(latest_message) or not _has_completed_booking(conversation, messages):
        return None

    response_text = (
        "You're welcome. Your appointment is all set, and the clinic staff dashboard "
        "has been updated. If you need anything else, you can start a new message anytime."
    )
    _save_assistant_message(db, conversation, response_text, "general_question", "low")
    conversation.status = "closed"
    db.add(conversation)
    return AIChatResponse(
        conversation_id=conversation.id,
        response=response_text,
        intent="general_question",
        urgency="low",
        needs_human=False,
        extracted_data={},
        available_slots=[],
        patient_appointments=[],
        appointment=None,
    )


def _public_appointment_message(payload: PublicAppointmentRequest) -> str:
    return "\n".join(
        [
            "I want to book an appointment using these details:",
            f"Patient name: {payload.patient_name}",
            f"Email: {payload.email or 'not provided'}",
            f"Phone: {payload.phone}",
            f"Patient type: {'new patient' if payload.new_patient else 'returning patient'}",
            f"Requested service: {payload.service}",
            f"Preferred date: {payload.preferred_date.isoformat()}",
            f"Preferred time: {payload.preferred_time.isoformat(timespec='minutes') if payload.preferred_time else 'flexible'}",
            f"Reason for visit: {payload.reason or 'not provided'}",
        ]
    )


def _save_assistant_message(
    db: Session,
    conversation: Conversation,
    response_text: str,
    intent: str,
    urgency: str,
) -> None:
    conversation.category = intent
    conversation.urgency = urgency
    conversation.updated_at = utc_now()
    db.add(
        Message(
            conversation_id=conversation.id,
            sender="assistant",
            content=response_text,
        )
    )
    db.add(conversation)


def _booking_guidance_response(available_slots: list[dict[str, Any]], latest_message: str) -> str:
    clean_message = " ".join(latest_message.strip().split())
    has_specific_detail = (
        len(clean_message) >= 18
        and any(
            keyword in clean_message.lower()
            for keyword in ("follow", "check", "therapy", "visit", "tomorrow", "morning", "afternoon")
        )
    )

    if available_slots:
        return (
            "I found appointment availability for that request. Please complete the "
            "appointment request form on this page with your full name, email, "
            "phone number, visit type, and preferred time so I can book an open "
            "slot, send your confirmation email, and update the clinic dashboard."
        )
    if has_specific_detail:
        return (
            f"Got it. I noted: {clean_message}. To book a real appointment, please "
            "complete the appointment request form on this page with your full name, "
            "email, phone number, visit type, and preferred date or time. Once you "
            "send it, I will check availability, book an open slot when possible, "
            "send your confirmation email, and update clinic staff."
        )
    return (
        "I can help with scheduling, but I need the complete appointment request "
        "before I can check and book a real slot. Please fill out the appointment "
        "request form on this page with your full name, email, phone number, visit "
        "type, and preferred date or time."
    )


def _service_options_text(db: Session, clinic_id: UUID) -> str:
    services = _active_services(db, clinic_id)
    if not services:
        return "The clinic has not configured active services yet."
    return ", ".join(service.name for service in services)


def _appointment_payload(appointment: Appointment, slot: AppointmentSlot, service: Service) -> dict[str, Any]:
    return {
        "id": str(appointment.id),
        "patient_id": str(appointment.patient_id),
        "provider_id": str(appointment.provider_id),
        "provider_name": slot.provider.name if slot.provider else "",
        "service_id": str(service.id),
        "service_name": service.name,
        "slot_id": str(slot.id),
        "status": appointment.status,
        "start_time": slot.start_time.isoformat(),
        "end_time": slot.end_time.isoformat(),
        "reason": appointment.reason,
    }


async def _handle_booking_chat(
    db: Session,
    clinic: Clinic,
    conversation: Conversation,
    messages: list[Message],
    latest_message: str,
) -> AIChatResponse | None:
    if not _is_booking_related(conversation, latest_message, messages):
        return None

    user_messages = [message.content for message in messages if message.sender == "user"]
    combined_user_text = "\n".join(user_messages)
    broad_availability_request = _requests_broad_availability(latest_message)
    requested_date = None if broad_availability_request else (
        _parse_requested_date(latest_message, clinic) or _parse_requested_date(combined_user_text, clinic)
    )
    requested_time = None if broad_availability_request else (
        _parse_requested_time(latest_message) or _parse_requested_time(combined_user_text)
    )
    selected_slot_id = _selected_slot_id_from_messages(messages)
    service = _match_service_from_text(db, clinic.id, combined_user_text)
    patient_details = _extract_patient_details(combined_user_text)

    conversation.category = "book_appointment"
    conversation.urgency = "low"
    conversation.updated_at = utc_now()

    provider_count = db.execute(
        select(func.count(Provider.id)).where(
            Provider.clinic_id == clinic.id,
            Provider.active.is_(True),
        )
    ).scalar_one()
    service_count = db.execute(
        select(func.count(Service.id)).where(
            Service.clinic_id == clinic.id,
            Service.active.is_(True),
        )
    ).scalar_one()
    if provider_count == 0 or service_count == 0:
        response_text = (
            f"{clinic.name} is connected to HealthDesk AI, but appointment booking "
            "has not been configured yet. Clinic staff need to add providers, "
            "services, and appointment slots in Settings before patients can book online."
        )
        _save_assistant_message(db, conversation, response_text, "book_appointment", "low")
        return AIChatResponse(
            conversation_id=conversation.id,
            response=response_text,
            intent="book_appointment",
            urgency="low",
            needs_human=True,
            extracted_data={"clinic_setup_required": True},
            available_slots=[],
        )

    if selected_slot_id is None:
        slots = _available_public_slots(db, clinic, requested_date, requested_time)
        if not slots:
            fallback_slots = (
                _available_public_slots(db, clinic, None, None)
                if requested_date is not None or requested_time is not None
                else []
            )
            if fallback_slots:
                requested_window = (
                    f" for {requested_date.isoformat()}"
                    if requested_date
                    else " at that exact time"
                )
                response_text = (
                    f"I do not see open appointment slots{requested_window} right now, "
                    "but here are the next available appointment slots. Choose one of these times, "
                    "then send your full name, email, phone number, and visit type so I can book it."
                )
                _save_assistant_message(db, conversation, response_text, "book_appointment", "low")
                return AIChatResponse(
                    conversation_id=conversation.id,
                    response=response_text,
                    intent="book_appointment",
                    urgency="low",
                    needs_human=False,
                    extracted_data={
                        "service": service.name if service else None,
                        "preferred_date": str(requested_date) if requested_date else None,
                    },
                    available_slots=[_slot_payload(slot) for slot in fallback_slots],
                )
            date_text = f" for {requested_date.isoformat()}" if requested_date else ""
            response_text = (
                f"I do not see open appointment slots{date_text} right now. "
                "Please tell me another preferred date or call the clinic for help."
            )
            _save_assistant_message(db, conversation, response_text, "book_appointment", "low")
            return AIChatResponse(
                conversation_id=conversation.id,
                response=response_text,
                intent="book_appointment",
                urgency="low",
                needs_human=True,
                extracted_data={},
                available_slots=[],
            )

        service_hint = (
            f" I noted the visit type as {service.name}."
            if service
            else f" Please also tell me the visit type. Available services: {_service_options_text(db, clinic.id)}."
        )
        response_text = (
            "Here are the next available appointment slots. Choose one of these times, "
            "then send your full name, email, phone number, and visit type so I can book it."
            f"{service_hint}"
        )
        _save_assistant_message(db, conversation, response_text, "book_appointment", "low")
        return AIChatResponse(
            conversation_id=conversation.id,
            response=response_text,
            intent="book_appointment",
            urgency="low",
            needs_human=False,
            extracted_data={
                "service": service.name if service else None,
                "preferred_date": str(requested_date) if requested_date else None,
                "preferred_time": requested_time.isoformat(timespec="minutes") if requested_time else None,
            },
            available_slots=[_slot_payload(slot) for slot in slots],
        )

    selected_slot = (
        db.execute(
            select(AppointmentSlot)
            .join(Provider, AppointmentSlot.provider_id == Provider.id)
            .where(
                AppointmentSlot.id == selected_slot_id,
                AppointmentSlot.clinic_id == clinic.id,
                Provider.active.is_(True),
            )
        )
        .scalars()
        .first()
    )
    selected_slot_taken = False
    if selected_slot is None:
        selected_slot_taken = True
    else:
        selected_slot_taken = bool(
            selected_slot.is_booked
            or db.execute(
                select(Appointment.id).where(Appointment.slot_id == selected_slot.id)
            ).scalar_one_or_none()
        )

    if selected_slot is None or selected_slot_taken:
        slots = _available_public_slots(db, clinic, requested_date, requested_time)
        response_text = (
            "That appointment slot is no longer available. Here are the current open slots."
            if slots
            else "That appointment slot is no longer available, and I do not see another open slot right now."
        )
        _save_assistant_message(db, conversation, response_text, "book_appointment", "low")
        return AIChatResponse(
            conversation_id=conversation.id,
            response=response_text,
            intent="book_appointment",
            urgency="low",
            needs_human=not bool(slots),
            extracted_data={},
            available_slots=[_slot_payload(slot) for slot in slots],
        )

    missing_fields: list[str] = []
    if service is None:
        missing_fields.append("visit type")
    if not patient_details.get("patient_name"):
        missing_fields.append("full name")
    if not patient_details.get("email"):
        missing_fields.append("email address")
    if not patient_details.get("phone"):
        missing_fields.append("phone number")

    if missing_fields:
        response_text = (
            f"I have { _format_slot(selected_slot, clinic) } selected. "
            f"Please send your {', '.join(missing_fields)} so I can book it. "
            "For example: My name is Jane Smith, email jane@example.com, phone 555-123-4567, visit type Follow-up Visit."
        )
        _save_assistant_message(db, conversation, response_text, "book_appointment", "low")
        return AIChatResponse(
            conversation_id=conversation.id,
            response=response_text,
            intent="book_appointment",
            urgency="low",
            needs_human=False,
            extracted_data={"missing_fields": missing_fields},
            available_slots=[],
        )

    try:
        appointment_data = await appointment_service.create_appointment_from_chat(
            db=db,
            clinic_id=clinic.id,
            patient_data={
                "patient_name": patient_details["patient_name"],
                "email": patient_details.get("email"),
                "phone": patient_details["phone"],
                "new_patient": True,
            },
            slot_id=selected_slot.id,
            service_id=service.id,
            reason=f"Requested through patient assistant for {service.name}",
        )
    except ValueError:
        slots = _available_public_slots(db, clinic, requested_date, requested_time)
        response_text = (
            "That slot was just taken. Please choose another available time."
            if slots
            else "That slot was just taken, and I do not see another open slot right now."
        )
        _save_assistant_message(db, conversation, response_text, "book_appointment", "low")
        return AIChatResponse(
            conversation_id=conversation.id,
            response=response_text,
            intent="book_appointment",
            urgency="low",
            needs_human=not bool(slots),
            extracted_data={},
            available_slots=[_slot_payload(slot) for slot in slots],
        )

    appointment = (
        db.execute(select(Appointment).where(Appointment.id == appointment_data["id"]))
        .scalars()
        .first()
    )
    if appointment is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Appointment was created but could not be loaded",
        )

    conversation.patient_id = appointment.patient_id
    conversation.status = "closed"
    response_text = (
        f"Your appointment is booked for {_format_slot(selected_slot, clinic)} "
        f"with {selected_slot.provider.name} for {service.name}. "
        "The clinic staff dashboard has been updated."
    )
    conversation.summary = response_text
    conversation.updated_at = utc_now()
    db.add(
        IntakeForm(
            clinic_id=clinic.id,
            patient_id=appointment.patient_id,
            conversation_id=conversation.id,
            reason_for_visit=f"Requested service: {service.name}",
            preferred_date=selected_slot.start_time.astimezone(_clinic_timezone(clinic)).date(),
            preferred_time=selected_slot.start_time.astimezone(_clinic_timezone(clinic)).time(),
            symptoms=None,
            missing_fields=[],
            ai_summary=response_text,
        )
    )
    _save_assistant_message(db, conversation, response_text, "book_appointment", "low")
    return AIChatResponse(
        conversation_id=conversation.id,
        response=response_text,
        intent="book_appointment",
        urgency="low",
        needs_human=False,
        extracted_data={
            "appointment_id": str(appointment.id),
            "service": service.name,
            "patient_name": patient_details["patient_name"],
            "phone": patient_details["phone"],
        },
        available_slots=[],
        appointment=_appointment_payload(appointment, selected_slot, service),
    )


async def _process_chat(
    payload: AIChatRequest,
    db: Session,
    channel: str,
) -> AIChatResponse:
    clinic = _get_clinic(db, payload.clinic_id)
    conversation = _get_or_create_conversation(
        db,
        clinic_id=clinic.id,
        conversation_id=payload.conversation_id,
        channel=channel,
    )
    db.add(
        Message(
            conversation_id=conversation.id,
            sender="user",
            content=payload.message,
        )
    )

    if check_escalation(payload.message):
        response_text = SAFE_ESCALATION_RESPONSE
        conversation.urgency = "emergency"
        conversation.category = "urgent_escalation"
        conversation.updated_at = utc_now()
        db.add(
            Escalation(
                clinic_id=clinic.id,
                conversation_id=conversation.id,
                reason=payload.message,
                urgency="emergency",
                status="open",
            )
        )
        db.add(
            Message(
                conversation_id=conversation.id,
                sender="assistant",
                content=response_text,
            )
        )
        db.add(conversation)
        db.commit()
        if clinic.email_notifications_escalation:
            try:
                admin_user = (
                    db.execute(
                        select(User).where(
                            User.clinic_id == clinic.id,
                            User.role == "admin",
                        )
                    )
                    .scalars()
                    .first()
                )
                if admin_user and admin_user.email:
                    asyncio.create_task(
                        send_escalation_alert(
                            clinic_name=clinic.name,
                            admin_email=admin_user.email,
                            patient_message=payload.message,
                            conversation_id=str(conversation.id),
                            urgency="emergency",
                            triggered_at=datetime.utcnow().strftime("%B %d, %Y at %I:%M %p UTC"),
                        )
                    )
            except Exception as exc:
                print(f"[EMAIL] Could not queue escalation alert: {exc}")
        return AIChatResponse(
            conversation_id=conversation.id,
            response=response_text,
            intent="urgent_escalation",
            urgency="emergency",
            needs_human=True,
            extracted_data={},
            available_slots=[],
        )

    db.flush()
    messages = _load_messages(db, conversation.id)
    courtesy_response = _handle_courtesy_after_booking(
        db=db,
        conversation=conversation,
        messages=messages,
        latest_message=payload.message,
    )
    if courtesy_response is not None:
        db.commit()
        return courtesy_response

    reschedule_response = _handle_reschedule_chat(
        db=db,
        clinic=clinic,
        conversation=conversation,
        messages=messages,
        latest_message=payload.message,
    )
    if reschedule_response is not None:
        db.commit()
        return reschedule_response

    lookup_response = _handle_appointment_lookup_chat(
        db=db,
        clinic=clinic,
        conversation=conversation,
        messages=messages,
        latest_message=payload.message,
    )
    if lookup_response is not None:
        db.commit()
        return lookup_response

    booking_response = await _handle_booking_chat(
        db=db,
        clinic=clinic,
        conversation=conversation,
        messages=messages,
        latest_message=payload.message,
    )
    if booking_response is not None:
        db.commit()
        return booking_response

    db.commit()

    messages = _load_messages(db, conversation.id)
    try:
        ai_result = await ai_service.chat(messages, _clinic_context(db, clinic))
    except AIServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    normalized = _normalize_ai_result(ai_result)
    available_slots: list[dict[str, Any]] = []
    if normalized["intent"] == "book_appointment":
        available_slots = await _available_slots_for_booking(
            db,
            clinic.id,
            normalized["extracted_data"],
        )
        normalized["response"] = _booking_guidance_response(available_slots, payload.message)
        normalized["needs_human"] = False

    conversation = _get_conversation(db, conversation.id, clinic.id)
    _save_assistant_message(
        db,
        conversation,
        response_text=normalized["response"],
        intent=normalized["intent"],
        urgency=normalized["urgency"],
    )
    db.commit()

    return AIChatResponse(
        conversation_id=conversation.id,
        response=normalized["response"],
        intent=normalized["intent"],
        urgency=normalized["urgency"],
        needs_human=normalized["needs_human"],
        extracted_data=normalized["extracted_data"],
        available_slots=available_slots,
        patient_appointments=[],
    )


@router.post("/chat", response_model=AIChatResponse)
@limiter.limit("20/minute")
async def chat(
    request: Request,
    payload: AIChatRequest,
    db: Session = Depends(get_db),
) -> AIChatResponse:
    _ = request
    return await _process_chat(payload, db, channel="chat")


@router.post("/appointment-request", response_model=PublicAppointmentResponse)
async def appointment_request(
    payload: PublicAppointmentRequest,
    db: Session = Depends(get_db),
) -> PublicAppointmentResponse:
    clinic = _get_clinic(db, payload.clinic_id)
    user_message = _public_appointment_message(payload)
    conversation = Conversation(
        clinic_id=clinic.id,
        channel="chat",
        status="open",
        urgency="low",
        category="book_appointment",
    )
    db.add(conversation)
    db.flush()
    db.add(Message(conversation_id=conversation.id, sender="user", content=user_message))

    if check_escalation(f"{payload.service} {payload.reason or ''}"):
        response_text = SAFE_ESCALATION_RESPONSE
        conversation.urgency = "emergency"
        conversation.category = "urgent_escalation"
        conversation.updated_at = utc_now()
        db.add(
            Escalation(
                clinic_id=clinic.id,
                conversation_id=conversation.id,
                reason=payload.reason or payload.service,
                urgency="emergency",
                status="open",
            )
        )
        db.add(Message(conversation_id=conversation.id, sender="assistant", content=response_text))
        db.add(conversation)
        db.commit()
        if clinic.email_notifications_escalation:
            try:
                admin_user = (
                    db.execute(
                        select(User).where(
                            User.clinic_id == clinic.id,
                            User.role == "admin",
                        )
                    )
                    .scalars()
                    .first()
                )
                if admin_user and admin_user.email:
                    asyncio.create_task(
                        send_escalation_alert(
                            clinic_name=clinic.name,
                            admin_email=admin_user.email,
                            patient_message=payload.reason or payload.service,
                            conversation_id=str(conversation.id),
                            urgency="emergency",
                            triggered_at=datetime.utcnow().strftime("%B %d, %Y at %I:%M %p UTC"),
                        )
                    )
            except Exception as exc:
                print(f"[EMAIL] Could not queue escalation alert: {exc}")
        return PublicAppointmentResponse(
            conversation_id=conversation.id,
            response=response_text,
            intent="urgent_escalation",
            urgency="emergency",
            needs_human=True,
            extracted_data={},
            available_slots=[],
            appointment=None,
        )

    service = _find_public_service(db, clinic.id, payload.service)
    if service is None:
        response_text = (
            "I could not find an active service for this clinic yet. "
            "Your request has been saved for staff review."
        )
        conversation.summary = response_text
        db.add(Message(conversation_id=conversation.id, sender="assistant", content=response_text))
        db.add(conversation)
        db.commit()
        return PublicAppointmentResponse(
            conversation_id=conversation.id,
            response=response_text,
            intent="book_appointment",
            urgency="low",
            needs_human=True,
            extracted_data={"requested_service": payload.service},
            available_slots=[],
            appointment=None,
        )

    candidate_slots = _slots_for_public_request(
        db,
        clinic=clinic,
        preferred_date=payload.preferred_date,
        preferred_time=payload.preferred_time,
    )
    candidate_slots = _exclude_taken_slots(db, candidate_slots)
    if not candidate_slots:
        response_text = (
            "I checked the schedule, but there are no open appointment slots available right now. "
            "Your request has been sent to clinic staff for follow-up."
        )
        conversation.summary = response_text
        db.add(
            IntakeForm(
                clinic_id=clinic.id,
                conversation_id=conversation.id,
                reason_for_visit=payload.reason,
                preferred_date=payload.preferred_date,
                preferred_time=payload.preferred_time,
                symptoms=payload.reason,
                missing_fields=[],
                ai_summary=response_text,
            )
        )
        db.add(Message(conversation_id=conversation.id, sender="assistant", content=response_text))
        db.add(conversation)
        db.commit()
        return PublicAppointmentResponse(
            conversation_id=conversation.id,
            response=response_text,
            intent="book_appointment",
            urgency="low",
            needs_human=True,
            extracted_data={"service": service.name, "preferred_date": str(payload.preferred_date)},
            available_slots=[],
            appointment=None,
        )

    db.add(conversation)
    db.commit()
    db.refresh(conversation)

    selected_slot = candidate_slots[0]
    appointment_data = await appointment_service.create_appointment_from_chat(
        db=db,
        clinic_id=clinic.id,
        patient_data={
            "patient_name": payload.patient_name,
            "email": str(payload.email).lower() if payload.email else None,
            "phone": payload.phone,
            "new_patient": payload.new_patient,
        },
        slot_id=selected_slot.id,
        service_id=service.id,
        reason=payload.reason or f"Requested service: {payload.service}",
    )
    appointment = (
        db.execute(select(Appointment).where(Appointment.id == appointment_data["id"]))
        .scalars()
        .first()
    )
    if appointment is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Appointment was created but could not be loaded",
        )

    requested_exact_date = selected_slot.start_time.astimezone(_clinic_timezone(clinic)).date() == payload.preferred_date
    selected_time_text = _format_slot(selected_slot, clinic)
    response_text = (
        f"Your appointment is booked for {selected_time_text} with {selected_slot.provider.name} "
        f"for {service.name}. The clinic dashboard has been updated, and staff can review your request there."
    )
    if not requested_exact_date:
        response_text = (
            f"The requested date was not available, so I booked the next available appointment: "
            f"{selected_time_text} with {selected_slot.provider.name} for {service.name}. "
            "The clinic dashboard has been updated, and staff can review your request there."
        )

    conversation.patient_id = appointment.patient_id
    conversation.summary = response_text
    conversation.updated_at = utc_now()
    db.add(
        IntakeForm(
            clinic_id=clinic.id,
            patient_id=appointment.patient_id,
            conversation_id=conversation.id,
            reason_for_visit=payload.reason,
            preferred_date=payload.preferred_date,
            preferred_time=payload.preferred_time,
            symptoms=payload.reason,
            missing_fields=[],
            ai_summary=response_text,
        )
    )
    db.add(Message(conversation_id=conversation.id, sender="assistant", content=response_text))
    db.add(conversation)
    db.commit()

    appointment_payload = {
        "id": str(appointment.id),
        "patient_id": str(appointment.patient_id),
        "provider_id": str(appointment.provider_id),
        "provider_name": selected_slot.provider.name,
        "service_id": str(service.id),
        "service_name": service.name,
        "slot_id": str(selected_slot.id),
        "status": appointment.status,
        "start_time": selected_slot.start_time.isoformat(),
        "end_time": selected_slot.end_time.isoformat(),
        "reason": appointment.reason,
    }
    return PublicAppointmentResponse(
        conversation_id=conversation.id,
        response=response_text,
        intent="book_appointment",
        urgency="low",
        needs_human=False,
        extracted_data={
            "service": service.name,
            "preferred_date": str(payload.preferred_date),
            "preferred_time": payload.preferred_time.isoformat(timespec="minutes") if payload.preferred_time else None,
            "appointment_id": str(appointment.id),
        },
        available_slots=[
            {
                "id": str(slot.id),
                "provider_id": str(slot.provider_id),
                "provider_name": slot.provider.name if slot.provider else None,
                "start_time": slot.start_time.isoformat(),
                "end_time": slot.end_time.isoformat(),
            }
            for slot in candidate_slots[:5]
        ],
        appointment=appointment_payload,
    )


def _public_clinic_response(db: Session) -> dict[str, str]:
    clinic = (
        db.execute(
            select(Clinic)
            .where(Clinic.name == "Sunrise Family Clinic")
            .order_by(Clinic.created_at.desc())
        )
        .scalars()
        .first()
    )
    if clinic is None:
        clinic = (
            db.execute(select(Clinic).order_by(Clinic.created_at.desc()))
            .scalars()
            .first()
        )
    if clinic is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No clinic is available for the public assistant",
        )

    return {
        "clinic_id": str(clinic.id),
        "name": clinic.name,
        "timezone": clinic.timezone,
    }


def _public_clinic_payload(db: Session, clinic: Clinic) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    slot_has_appointment = (
        select(Appointment.id)
        .where(Appointment.slot_id == AppointmentSlot.id)
        .exists()
    )
    provider_count = db.execute(
        select(func.count(Provider.id)).where(
            Provider.clinic_id == clinic.id,
            Provider.active.is_(True),
        )
    ).scalar_one()
    service_count = db.execute(
        select(func.count(Service.id)).where(
            Service.clinic_id == clinic.id,
            Service.active.is_(True),
        )
    ).scalar_one()
    available_slot_count = db.execute(
        select(func.count(AppointmentSlot.id))
        .join(Provider, AppointmentSlot.provider_id == Provider.id)
        .where(
            AppointmentSlot.clinic_id == clinic.id,
            AppointmentSlot.is_booked.is_(False),
            AppointmentSlot.start_time >= now,
            Provider.active.is_(True),
            ~slot_has_appointment,
        )
    ).scalar_one()
    return {
        "clinic_id": str(clinic.id),
        "name": clinic.name,
        "phone": clinic.phone,
        "email": clinic.email,
        "address": clinic.address,
        "timezone": clinic.timezone,
        "provider_count": provider_count,
        "service_count": service_count,
        "available_slot_count": available_slot_count,
    }


@router.get("/public-clinic")
def public_clinic(db: Session = Depends(get_db)) -> dict[str, str]:
    return _public_clinic_response(db)


@router.get("/public-clinics")
def public_clinics(db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    clinics = (
        db.execute(select(Clinic).order_by(Clinic.name, Clinic.created_at))
        .scalars()
        .all()
    )
    clinic_payloads = [_public_clinic_payload(db, clinic) for clinic in clinics]
    hidden_test_prefixes = (
        "AI Test Clinic",
        "Auth Flow Clinic",
        "Phase Two Clinic",
        "Phase Four Clinic",
        "Phase Four Live Clinic",
        "Phase4 Verification Clinic",
        "Updated Clinic",
        "Verify Clinic",
    )
    visible_clinics = [
        clinic
        for clinic in clinic_payloads
        if not any(str(clinic["name"]).startswith(prefix) for prefix in hidden_test_prefixes)
    ]
    if not visible_clinics:
        visible_clinics = clinic_payloads
    return sorted(
        visible_clinics,
        key=lambda clinic: (
            not (
                clinic["provider_count"] > 0
                and clinic["service_count"] > 0
                and clinic["available_slot_count"] > 0
            ),
            -(clinic["available_slot_count"] or 0),
            str(clinic["name"]).lower(),
        ),
    )


@router.get("/demo-clinic")
def demo_clinic(db: Session = Depends(get_db)) -> dict[str, str]:
    return _public_clinic_response(db)


@router.post("/voice/transcript", response_model=AIChatResponse)
async def voice_transcript(
    payload: AIVoiceTranscriptRequest,
    db: Session = Depends(get_db),
) -> AIChatResponse:
    chat_payload = AIChatRequest(
        conversation_id=payload.conversation_id,
        message=payload.transcript,
        clinic_id=payload.clinic_id,
    )
    return await _process_chat(chat_payload, db, channel="voice")


@router.post("/summarize", response_model=AISummaryResponse)
async def summarize(payload: AISummarizeRequest, db: Session = Depends(get_db)) -> AISummaryResponse:
    conversation = _get_conversation(db, payload.conversation_id)
    messages = _load_messages(db, conversation.id)
    try:
        summary = await ai_service.summarize_conversation(messages)
    except AIServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    conversation.summary = summary
    conversation.updated_at = utc_now()
    db.add(conversation)
    db.commit()
    return AISummaryResponse(summary=summary)


@router.post("/classify-intent", response_model=AIIntentResponse)
async def classify_intent(
    payload: AIClassifyIntentRequest,
) -> AIIntentResponse:
    try:
        intent = await ai_service.classify_intent(payload.message)
    except AIServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    return AIIntentResponse(intent=intent)


@router.post("/extract-intake", response_model=IntakeExtractionResponse)
async def extract_intake(
    payload: AIExtractIntakeRequest,
    db: Session = Depends(get_db),
) -> IntakeExtractionResponse:
    conversation = _get_conversation(db, payload.conversation_id)
    messages = _load_messages(db, conversation.id)
    try:
        extracted = await ai_service.extract_intake(messages)
    except AIServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    missing_fields = [
        field
        for field in (
            "reason_for_visit",
            "insurance_provider",
            "preferred_date",
            "preferred_time",
            "symptoms",
        )
        if not extracted.get(field)
    ]
    intake_form = (
        db.execute(
            select(IntakeForm).where(
                IntakeForm.conversation_id == conversation.id,
                IntakeForm.clinic_id == conversation.clinic_id,
            )
        )
        .scalars()
        .first()
    )
    if intake_form is None:
        intake_form = IntakeForm(
            clinic_id=conversation.clinic_id,
            patient_id=conversation.patient_id,
            conversation_id=conversation.id,
        )

    intake_form.reason_for_visit = extracted.get("reason_for_visit")
    intake_form.insurance_provider = extracted.get("insurance_provider")
    intake_form.preferred_date = _parse_date(extracted.get("preferred_date"))
    intake_form.preferred_time = _parse_time(extracted.get("preferred_time"))
    intake_form.symptoms = extracted.get("symptoms")
    intake_form.ai_summary = conversation.summary
    intake_form.missing_fields = missing_fields
    db.add(intake_form)
    db.commit()

    return IntakeExtractionResponse(**extracted)
