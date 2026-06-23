from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.all_models import Appointment, AppointmentSlot, Patient, Provider, Service


def _clinic_timezone(timezone_name: str | None) -> ZoneInfo:
    try:
        return ZoneInfo(timezone_name or "America/Phoenix")
    except Exception:
        return ZoneInfo("America/Phoenix")


def lookup_upcoming_appointments(
    db: Session,
    clinic_id: UUID,
    email: str,
    timezone_name: str | None = "America/Phoenix",
    limit: int = 5,
) -> dict:
    patient = (
        db.execute(
            select(Patient).where(
                Patient.clinic_id == clinic_id,
                Patient.email.ilike(email.strip().lower()),
            )
        )
        .scalars()
        .first()
    )
    if patient is None:
        return {"found": False, "patient_name": None, "appointments": []}

    rows = (
        db.execute(
            select(Appointment, Provider, Service, AppointmentSlot)
            .join(Provider, Appointment.provider_id == Provider.id)
            .join(Service, Appointment.service_id == Service.id)
            .join(AppointmentSlot, Appointment.slot_id == AppointmentSlot.id)
            .where(
                Appointment.clinic_id == clinic_id,
                Appointment.patient_id == patient.id,
                Appointment.status.in_(("scheduled", "rescheduled")),
                AppointmentSlot.start_time >= datetime.now(timezone.utc),
            )
            .order_by(AppointmentSlot.start_time.asc())
            .limit(limit)
        )
        .all()
    )

    appointments = []
    clinic_tz = _clinic_timezone(timezone_name)
    for appointment, provider, service, slot in rows:
        local_start = slot.start_time.astimezone(clinic_tz)
        appointments.append(
            {
                "id": str(appointment.id),
                "provider_name": provider.name,
                "service_name": service.name,
                "date": local_start.strftime("%A, %B %d, %Y").replace(" 0", " "),
                "time": local_start.strftime("%I:%M %p %Z").replace(" 0", " "),
                "status": appointment.status,
            }
        )

    return {
        "found": True,
        "patient_name": f"{patient.first_name} {patient.last_name}".strip(),
        "appointments": appointments,
    }
