from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.all_models import Appointment, AppointmentSlot, Clinic, Patient, Provider, Service, User
from app.schemas.all_schemas import (
    AppointmentCreateRequest,
    AppointmentLookupResponse,
    AppointmentRescheduleRequest,
    AppointmentResponse,
    AppointmentSlotCreateRequest,
    AppointmentSlotResponse,
    AppointmentStatus,
)
from app.services.appointment_lookup_service import lookup_upcoming_appointments
from app.services.appointment_service import send_booking_confirmation


router = APIRouter(tags=["appointments"])


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _clinic_id(current_user: User) -> UUID:
    if current_user.clinic_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Current user is not linked to a clinic",
        )
    return current_user.clinic_id


def _require_admin(current_user: User) -> None:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only clinic admins can create appointment slots",
        )


def _date_start(value: date) -> datetime:
    return datetime.combine(value, time.min).replace(tzinfo=timezone.utc)


def _date_end(value: date) -> datetime:
    return datetime.combine(value + timedelta(days=1), time.min).replace(tzinfo=timezone.utc)


def _appointment_response(row: tuple[Appointment, Patient, Provider, Service, AppointmentSlot]) -> AppointmentResponse:
    appointment, patient, provider, service, slot = row
    return AppointmentResponse(
        id=appointment.id,
        clinic_id=appointment.clinic_id,
        patient_id=appointment.patient_id,
        provider_id=appointment.provider_id,
        service_id=appointment.service_id,
        slot_id=appointment.slot_id,
        status=appointment.status,
        reason=appointment.reason,
        notes=appointment.notes,
        created_at=appointment.created_at,
        updated_at=appointment.updated_at,
        patient_name=f"{patient.first_name} {patient.last_name}".strip(),
        provider_name=provider.name,
        service_name=service.name,
        start_time=slot.start_time,
        end_time=slot.end_time,
    )


def _slot_response(slot: AppointmentSlot, provider_name: str) -> AppointmentSlotResponse:
    return AppointmentSlotResponse(
        id=slot.id,
        clinic_id=slot.clinic_id,
        provider_id=slot.provider_id,
        provider_name=provider_name,
        start_time=slot.start_time,
        end_time=slot.end_time,
        is_booked=slot.is_booked,
        created_at=slot.created_at,
    )


def _appointment_query(clinic_id: UUID):
    return (
        select(Appointment, Patient, Provider, Service, AppointmentSlot)
        .join(Patient, Appointment.patient_id == Patient.id)
        .join(Provider, Appointment.provider_id == Provider.id)
        .join(Service, Appointment.service_id == Service.id)
        .join(AppointmentSlot, Appointment.slot_id == AppointmentSlot.id)
        .where(Appointment.clinic_id == clinic_id)
    )


def _get_appointment(db: Session, appointment_id: UUID, clinic_id: UUID) -> Appointment:
    appointment = (
        db.execute(
            select(Appointment).where(
                Appointment.id == appointment_id,
                Appointment.clinic_id == clinic_id,
            )
        )
        .scalars()
        .first()
    )
    if appointment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    return appointment


def _get_available_slot(db: Session, slot_id: UUID, clinic_id: UUID) -> AppointmentSlot:
    slot = (
        db.execute(
            select(AppointmentSlot).where(
                AppointmentSlot.id == slot_id,
                AppointmentSlot.clinic_id == clinic_id,
            )
        )
        .scalars()
        .first()
    )
    if slot is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment slot not found")
    if slot.is_booked:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Appointment slot is already booked")
    return slot


def _validate_clinic_record(db: Session, model, item_id: UUID, clinic_id: UUID, label: str):
    item = (
        db.execute(select(model).where(model.id == item_id, model.clinic_id == clinic_id))
        .scalars()
        .first()
    )
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{label} not found")
    return item


def _get_joined_appointment(db: Session, appointment_id: UUID, clinic_id: UUID) -> AppointmentResponse:
    row = (
        db.execute(
            _appointment_query(clinic_id)
            .where(Appointment.id == appointment_id)
            .order_by(Appointment.created_at.desc())
        )
        .first()
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    return _appointment_response(row)


@router.get("/appointments", response_model=list[AppointmentResponse])
def list_appointments(
    status_filter: AppointmentStatus | None = Query(default=None, alias="status"),
    provider_id: UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[AppointmentResponse]:
    clinic_id = _clinic_id(current_user)
    query = _appointment_query(clinic_id)
    if status_filter is not None:
        query = query.where(Appointment.status == status_filter)
    if provider_id is not None:
        query = query.where(Appointment.provider_id == provider_id)
    if date_from is not None:
        query = query.where(AppointmentSlot.start_time >= _date_start(date_from))
    if date_to is not None:
        query = query.where(AppointmentSlot.start_time < _date_end(date_to))

    rows = db.execute(query.order_by(AppointmentSlot.start_time.desc())).all()
    return [_appointment_response(row) for row in rows]


@router.get("/appointments/lookup", response_model=AppointmentLookupResponse)
def lookup_appointments(
    email: str = Query(..., min_length=3),
    clinic_id: UUID = Query(...),
    db: Session = Depends(get_db),
) -> AppointmentLookupResponse:
    clinic = db.get(Clinic, clinic_id)
    if clinic is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clinic not found")
    return AppointmentLookupResponse(
        **lookup_upcoming_appointments(db, clinic_id, email, clinic.timezone)
    )


@router.post("/appointments", response_model=AppointmentResponse)
async def create_appointment(
    payload: AppointmentCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AppointmentResponse:
    clinic_id = _clinic_id(current_user)
    clinic = db.get(Clinic, clinic_id)
    if clinic is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clinic not found")
    patient = _validate_clinic_record(db, Patient, payload.patient_id, clinic_id, "Patient")
    provider = _validate_clinic_record(db, Provider, payload.provider_id, clinic_id, "Provider")
    service = _validate_clinic_record(db, Service, payload.service_id, clinic_id, "Service")
    slot = _get_available_slot(db, payload.slot_id, clinic_id)
    if slot.provider_id != payload.provider_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected slot does not belong to the selected provider",
        )

    appointment = Appointment(
        clinic_id=clinic_id,
        patient_id=payload.patient_id,
        provider_id=payload.provider_id,
        service_id=payload.service_id,
        slot_id=payload.slot_id,
        status="scheduled",
        reason=payload.reason,
        notes=payload.notes,
    )
    slot.is_booked = True
    db.add(slot)
    db.add(appointment)
    db.commit()
    db.refresh(appointment)
    try:
        await send_booking_confirmation(
            db=db,
            appointment=appointment,
            clinic=clinic,
            patient=patient,
            provider_name=provider.name,
            service=service,
            slot=slot,
        )
    except Exception as exc:
        print(f"[EMAIL] Could not send appointment confirmation: {exc}")
    return _get_joined_appointment(db, appointment.id, clinic_id)


@router.patch("/appointments/{appointment_id}/reschedule", response_model=AppointmentResponse)
def reschedule_appointment(
    appointment_id: UUID,
    payload: AppointmentRescheduleRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AppointmentResponse:
    clinic_id = _clinic_id(current_user)
    appointment = _get_appointment(db, appointment_id, clinic_id)
    new_slot = _get_available_slot(db, payload.new_slot_id, clinic_id)
    if new_slot.provider_id != appointment.provider_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New slot must belong to the appointment provider",
        )

    old_slot = db.get(AppointmentSlot, appointment.slot_id)
    if old_slot is not None and old_slot.clinic_id == clinic_id:
        old_slot.is_booked = False
        db.add(old_slot)

    new_slot.is_booked = True
    appointment.slot_id = new_slot.id
    appointment.status = "rescheduled"
    appointment.updated_at = utc_now()
    appointment.reminder_email_sent_at = None
    db.add(new_slot)
    db.add(appointment)
    db.commit()
    return _get_joined_appointment(db, appointment.id, clinic_id)


@router.patch("/appointments/{appointment_id}/cancel", response_model=AppointmentResponse)
def cancel_appointment(
    appointment_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AppointmentResponse:
    clinic_id = _clinic_id(current_user)
    appointment = _get_appointment(db, appointment_id, clinic_id)
    slot = db.get(AppointmentSlot, appointment.slot_id)
    if slot is not None and slot.clinic_id == clinic_id:
        slot.is_booked = False
        db.add(slot)

    appointment.status = "cancelled"
    appointment.updated_at = utc_now()
    db.add(appointment)
    db.commit()
    return _get_joined_appointment(db, appointment.id, clinic_id)


@router.get("/appointment-slots", response_model=list[AppointmentSlotResponse])
def list_appointment_slots(
    provider_id: UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    service_id: UUID | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[AppointmentSlotResponse]:
    clinic_id = _clinic_id(current_user)
    if service_id is not None:
        _validate_clinic_record(db, Service, service_id, clinic_id, "Service")

    query = (
        select(AppointmentSlot, Provider.name)
        .join(Provider, AppointmentSlot.provider_id == Provider.id)
        .where(
            AppointmentSlot.clinic_id == clinic_id,
            AppointmentSlot.is_booked.is_(False),
        )
    )
    if provider_id is not None:
        query = query.where(AppointmentSlot.provider_id == provider_id)
    if date_from is not None:
        query = query.where(AppointmentSlot.start_time >= _date_start(date_from))
    if date_to is not None:
        query = query.where(AppointmentSlot.start_time < _date_end(date_to))

    rows = db.execute(query.order_by(AppointmentSlot.start_time.asc())).all()
    return [_slot_response(slot, provider_name) for slot, provider_name in rows]


@router.post("/appointment-slots", response_model=AppointmentSlotResponse)
def create_appointment_slot(
    payload: AppointmentSlotCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AppointmentSlotResponse:
    _require_admin(current_user)
    clinic_id = _clinic_id(current_user)
    provider = _validate_clinic_record(db, Provider, payload.provider_id, clinic_id, "Provider")
    if payload.end_time <= payload.start_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Slot end_time must be after start_time",
        )

    slot = AppointmentSlot(
        clinic_id=clinic_id,
        provider_id=payload.provider_id,
        start_time=payload.start_time,
        end_time=payload.end_time,
        is_booked=False,
    )
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return _slot_response(slot, provider.name)
