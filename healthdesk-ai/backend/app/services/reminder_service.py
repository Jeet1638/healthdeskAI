from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.core.database import SessionLocal
from app.models.all_models import Appointment, AppointmentSlot, Clinic, Patient
from app.services.appointment_service import format_slot_for_email
from app.services.email_service import send_appointment_reminder


REMINDER_LOOKAHEAD = timedelta(hours=1)
REMINDER_POLL_SECONDS = 60


async def send_due_appointment_reminders_once() -> int:
    now = datetime.now(timezone.utc)
    due_by = now + REMINDER_LOOKAHEAD
    sent_count = 0

    with SessionLocal() as db:
        appointments = (
            db.execute(
                select(Appointment)
                .join(AppointmentSlot, Appointment.slot_id == AppointmentSlot.id)
                .join(Patient, Appointment.patient_id == Patient.id)
                .join(Clinic, Appointment.clinic_id == Clinic.id)
                .options(
                    joinedload(Appointment.clinic),
                    joinedload(Appointment.patient),
                    joinedload(Appointment.provider),
                    joinedload(Appointment.service),
                    joinedload(Appointment.slot),
                )
                .where(
                    Appointment.status.in_(("scheduled", "rescheduled")),
                    Appointment.reminder_email_sent_at.is_(None),
                    AppointmentSlot.start_time > now,
                    AppointmentSlot.start_time <= due_by,
                    Patient.email.is_not(None),
                    Clinic.email_notifications_appointments.is_(True),
                )
                .order_by(AppointmentSlot.start_time.asc())
                .limit(50)
            )
            .scalars()
            .all()
        )

        for appointment in appointments:
            patient = appointment.patient
            clinic = appointment.clinic
            provider = appointment.provider
            service = appointment.service
            slot = appointment.slot
            if not patient.email:
                continue

            appointment_date, appointment_time = format_slot_for_email(slot, clinic)
            sent = await send_appointment_reminder(
                patient_email=patient.email,
                patient_name=f"{patient.first_name} {patient.last_name}".strip(),
                clinic_name=clinic.name,
                clinic_phone=clinic.phone or "Contact clinic",
                provider_name=provider.name if provider else "Clinic provider",
                service_name=service.name if service else "Appointment",
                appointment_date=appointment_date,
                appointment_time=appointment_time,
                clinic_address=clinic.address or "See clinic for address",
            )
            if sent:
                appointment.reminder_email_sent_at = datetime.now(timezone.utc)
                db.add(appointment)
                db.commit()
                sent_count += 1

    if sent_count:
        print(f"[EMAIL] Sent {sent_count} appointment reminder email(s)")
    return sent_count


async def appointment_reminder_scheduler(stop_event: asyncio.Event) -> None:
    while not stop_event.is_set():
        try:
            await send_due_appointment_reminders_once()
        except Exception as exc:
            print(f"[EMAIL] Reminder scheduler error: {exc}")

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=REMINDER_POLL_SECONDS)
        except asyncio.TimeoutError:
            continue
