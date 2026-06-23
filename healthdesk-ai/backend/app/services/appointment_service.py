from __future__ import annotations

from datetime import date, datetime, time, timezone
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.models.all_models import Appointment, AppointmentSlot, Clinic, Patient, Provider, Service
from app.services.email_service import send_appointment_confirmation


def _as_datetime(value: datetime | date | str | None, end_of_day: bool = False) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime.combine(value, time.max if end_of_day else time.min, tzinfo=timezone.utc)
    parsed = datetime.fromisoformat(str(value))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def _slot_to_dict(slot: AppointmentSlot) -> dict[str, Any]:
    return {
        "id": slot.id,
        "clinic_id": slot.clinic_id,
        "provider_id": slot.provider_id,
        "provider_name": slot.provider.name if slot.provider else None,
        "start_time": slot.start_time,
        "end_time": slot.end_time,
        "is_booked": slot.is_booked,
    }


def _clinic_zone(clinic: Clinic) -> ZoneInfo:
    try:
        return ZoneInfo(clinic.timezone or "America/Phoenix")
    except Exception:
        return ZoneInfo("America/Phoenix")


def format_slot_for_email(slot: AppointmentSlot, clinic: Clinic) -> tuple[str, str]:
    local_start = slot.start_time.astimezone(_clinic_zone(clinic))
    appointment_date = local_start.strftime("%A, %B %d, %Y")
    appointment_time = local_start.strftime("%I:%M %p %Z").lstrip("0")
    return appointment_date, appointment_time


async def send_booking_confirmation(
    db: Session,
    appointment: Appointment,
    clinic: Clinic,
    patient: Patient,
    provider_name: str,
    service: Service,
    slot: AppointmentSlot,
) -> bool:
    if not clinic.email_notifications_appointments or not patient.email:
        return False

    appointment_date, appointment_time = format_slot_for_email(slot, clinic)
    sent = await send_appointment_confirmation(
        patient_email=patient.email,
        patient_name=f"{patient.first_name} {patient.last_name}".strip(),
        clinic_name=clinic.name,
        clinic_phone=clinic.phone or "Contact clinic",
        provider_name=provider_name,
        service_name=service.name,
        appointment_date=appointment_date,
        appointment_time=appointment_time,
        clinic_address=clinic.address or "See clinic for address",
    )
    if sent:
        appointment.confirmation_email_sent_at = datetime.now(timezone.utc)
        db.add(appointment)
        db.commit()
        db.refresh(appointment)
    return sent


async def get_available_slots(
    db: Session,
    clinic_id,
    provider_id=None,
    service_id=None,
    date_from=None,
    date_to=None,
) -> list:
    query = (
        select(AppointmentSlot)
        .join(Provider, AppointmentSlot.provider_id == Provider.id)
        .where(
            AppointmentSlot.clinic_id == clinic_id,
            AppointmentSlot.is_booked.is_(False),
            Provider.active.is_(True),
        )
        .order_by(AppointmentSlot.start_time)
        .limit(25)
    )

    if provider_id is not None:
        query = query.where(AppointmentSlot.provider_id == provider_id)

    if service_id is not None:
        service_exists = db.execute(
            select(Service.id).where(
                Service.id == service_id,
                Service.clinic_id == clinic_id,
                Service.active.is_(True),
            )
        ).scalar_one_or_none()
        if service_exists is None:
            return []

    start_boundary = _as_datetime(date_from)
    end_boundary = _as_datetime(date_to, end_of_day=True)
    if start_boundary is not None:
        query = query.where(AppointmentSlot.start_time >= start_boundary)
    if end_boundary is not None:
        query = query.where(AppointmentSlot.start_time <= end_boundary)

    slots = db.execute(query).scalars().all()
    return [_slot_to_dict(slot) for slot in slots]


def _split_patient_name(patient_data: dict[str, Any]) -> tuple[str, str]:
    first_name = str(patient_data.get("first_name") or "").strip()
    last_name = str(patient_data.get("last_name") or "").strip()
    if first_name and last_name:
        return first_name, last_name

    full_name = str(patient_data.get("name") or patient_data.get("patient_name") or "").strip()
    if full_name:
        parts = full_name.split()
        if len(parts) >= 2:
            return parts[0], " ".join(parts[1:])
        return parts[0], "Patient"

    raise ValueError("Patient first_name and last_name are required to create an appointment")


async def create_appointment_from_chat(
    db: Session,
    clinic_id,
    patient_data,
    slot_id,
    service_id,
    reason,
) -> dict:
    clinic = db.get(Clinic, clinic_id)
    if clinic is None:
        raise ValueError("Clinic is not available")

    slot = db.execute(
        select(AppointmentSlot).where(
            AppointmentSlot.id == slot_id,
            AppointmentSlot.clinic_id == clinic_id,
            AppointmentSlot.is_booked.is_(False),
            ~select(Appointment.id)
            .where(Appointment.slot_id == AppointmentSlot.id)
            .exists(),
        )
    ).scalars().first()
    if slot is None:
        raise ValueError("Appointment slot is not available")

    existing_appointment = db.execute(
        select(Appointment.id).where(
            Appointment.slot_id == slot_id,
        )
    ).scalar_one_or_none()
    if existing_appointment is not None:
        slot.is_booked = True
        db.add(slot)
        db.flush()
        raise ValueError("Appointment slot is not available")

    service = db.execute(
        select(Service).where(
            Service.id == service_id,
            Service.clinic_id == clinic_id,
            Service.active.is_(True),
        )
    ).scalars().first()
    if service is None:
        raise ValueError("Service is not available for this clinic")

    email = patient_data.get("email")
    phone = patient_data.get("phone")
    patient_query = select(Patient).where(Patient.clinic_id == clinic_id)
    contact_filters = []
    if email:
        contact_filters.append(Patient.email == str(email).lower())
    if phone:
        contact_filters.append(Patient.phone == str(phone))
    patient = None
    if contact_filters:
        patient = db.execute(patient_query.where(or_(*contact_filters))).scalars().first()

    if patient is None:
        first_name, last_name = _split_patient_name(patient_data)
        patient = Patient(
            clinic_id=clinic_id,
            first_name=first_name,
            last_name=last_name,
            email=str(email).lower() if email else None,
            phone=str(phone) if phone else None,
            new_patient=bool(patient_data.get("new_patient", True)),
        )
        db.add(patient)
        db.flush()

    appointment = Appointment(
        clinic_id=clinic_id,
        patient_id=patient.id,
        provider_id=slot.provider_id,
        service_id=service.id,
        slot_id=slot.id,
        status="scheduled",
        reason=reason,
    )
    provider_name = slot.provider.name if slot.provider else "Clinic provider"
    slot.is_booked = True
    db.add(appointment)
    db.add(slot)
    db.commit()
    db.refresh(appointment)

    try:
        await send_booking_confirmation(
            db=db,
            appointment=appointment,
            clinic=clinic,
            patient=patient,
            provider_name=provider_name,
            service=service,
            slot=slot,
        )
    except Exception as exc:
        print(f"[EMAIL] Could not send appointment confirmation: {exc}")

    return {
        "id": appointment.id,
        "clinic_id": appointment.clinic_id,
        "patient_id": appointment.patient_id,
        "provider_id": appointment.provider_id,
        "service_id": appointment.service_id,
        "slot_id": appointment.slot_id,
        "status": appointment.status,
        "reason": appointment.reason,
        "created_at": appointment.created_at,
        "updated_at": appointment.updated_at,
    }
