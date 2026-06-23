from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.all_models import (
    Appointment,
    AppointmentSlot,
    Conversation,
    IntakeForm,
    Message,
    Patient,
    Provider,
    Service,
    User,
)
from app.schemas.all_schemas import (
    PatientAppointmentResponse,
    PatientConversationResponse,
    PatientCreateRequest,
    PatientDetailResponse,
    PatientIntakeFormResponse,
    PatientListResponse,
    PatientResponse,
    PatientUpdate,
)


router = APIRouter(prefix="/patients", tags=["patients"])


def _clinic_id(current_user: User) -> UUID:
    if current_user.clinic_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Current user is not linked to a clinic",
        )
    return current_user.clinic_id


def _patient_response(patient: Patient) -> PatientResponse:
    return PatientResponse(
        id=patient.id,
        clinic_id=patient.clinic_id,
        first_name=patient.first_name,
        last_name=patient.last_name,
        email=patient.email,
        phone=patient.phone,
        date_of_birth=patient.date_of_birth,
        new_patient=patient.new_patient,
        created_at=patient.created_at,
    )


def _get_patient(db: Session, patient_id: UUID, clinic_id: UUID) -> Patient:
    patient = (
        db.execute(select(Patient).where(Patient.id == patient_id, Patient.clinic_id == clinic_id))
        .scalars()
        .first()
    )
    if patient is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    return patient


@router.get("", response_model=PatientListResponse)
def list_patients(
    search: str | None = None,
    new_patient: bool | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PatientListResponse:
    clinic_id = _clinic_id(current_user)
    query = select(Patient).where(Patient.clinic_id == clinic_id)
    count_query = select(func.count(Patient.id)).where(Patient.clinic_id == clinic_id)

    filters = []
    if search:
        term = f"%{search.strip()}%"
        filters.append(
            or_(
                Patient.first_name.ilike(term),
                Patient.last_name.ilike(term),
                Patient.email.ilike(term),
            )
        )
    if new_patient is not None:
        filters.append(Patient.new_patient.is_(new_patient))

    for condition in filters:
        query = query.where(condition)
        count_query = count_query.where(condition)

    total = db.execute(count_query).scalar_one()
    patients = (
        db.execute(
            query.order_by(Patient.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        .scalars()
        .all()
    )

    return PatientListResponse(
        items=[_patient_response(patient) for patient in patients],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=PatientResponse)
def create_patient(
    payload: PatientCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PatientResponse:
    clinic_id = _clinic_id(current_user)
    patient = Patient(
        clinic_id=clinic_id,
        first_name=payload.first_name,
        last_name=payload.last_name,
        email=payload.email,
        phone=payload.phone,
        date_of_birth=payload.date_of_birth,
        new_patient=payload.new_patient,
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return _patient_response(patient)


@router.get("/{patient_id}", response_model=PatientDetailResponse)
def get_patient(
    patient_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PatientDetailResponse:
    clinic_id = _clinic_id(current_user)
    patient = _get_patient(db, patient_id, clinic_id)

    appointment_rows = db.execute(
        select(Appointment, Provider.name, Service.name, AppointmentSlot.start_time, AppointmentSlot.end_time)
        .join(Provider, Appointment.provider_id == Provider.id)
        .join(Service, Appointment.service_id == Service.id)
        .join(AppointmentSlot, Appointment.slot_id == AppointmentSlot.id)
        .where(Appointment.clinic_id == clinic_id, Appointment.patient_id == patient.id)
        .order_by(AppointmentSlot.start_time.desc())
    ).all()

    conversation_rows = db.execute(
        select(Conversation, func.count(Message.id).label("message_count"))
        .outerjoin(Message, Conversation.id == Message.conversation_id)
        .where(Conversation.clinic_id == clinic_id, Conversation.patient_id == patient.id)
        .group_by(Conversation.id)
        .order_by(Conversation.updated_at.desc())
    ).all()

    intake_forms = (
        db.execute(
            select(IntakeForm)
            .where(IntakeForm.clinic_id == clinic_id, IntakeForm.patient_id == patient.id)
            .order_by(IntakeForm.created_at.desc())
        )
        .scalars()
        .all()
    )

    base = _patient_response(patient).model_dump()
    return PatientDetailResponse(
        **base,
        appointments=[
            PatientAppointmentResponse(
                id=appointment.id,
                service_name=service_name,
                provider_name=provider_name,
                start_time=start_time,
                end_time=end_time,
                status=appointment.status,
                reason=appointment.reason,
            )
            for appointment, provider_name, service_name, start_time, end_time in appointment_rows
        ],
        conversations=[
            PatientConversationResponse(
                id=conversation.id,
                channel=conversation.channel,
                urgency=conversation.urgency,
                status=conversation.status,
                category=conversation.category,
                summary=conversation.summary,
                created_at=conversation.created_at,
                message_count=message_count,
            )
            for conversation, message_count in conversation_rows
        ],
        intake_forms=[
            PatientIntakeFormResponse(
                id=form.id,
                reason_for_visit=form.reason_for_visit,
                insurance_provider=form.insurance_provider,
                preferred_date=form.preferred_date,
                preferred_time=form.preferred_time,
                symptoms=form.symptoms,
                ai_summary=form.ai_summary,
                missing_fields=form.missing_fields or [],
                created_at=form.created_at,
            )
            for form in intake_forms
        ],
    )


@router.patch("/{patient_id}", response_model=PatientResponse)
def update_patient(
    patient_id: UUID,
    payload: PatientUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PatientResponse:
    clinic_id = _clinic_id(current_user)
    patient = _get_patient(db, patient_id, clinic_id)
    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(patient, key, value)

    db.add(patient)
    db.commit()
    db.refresh(patient)
    return _patient_response(patient)
