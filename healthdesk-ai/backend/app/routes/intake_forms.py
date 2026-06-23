from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.all_models import Conversation, IntakeForm, Patient, User
from app.schemas.all_schemas import IntakeFormListItem, Urgency


router = APIRouter(prefix="/intake-forms", tags=["intake-forms"])


def _clinic_id(current_user: User) -> UUID:
    if current_user.clinic_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Current user is not linked to a clinic",
        )
    return current_user.clinic_id


def _date_start(value: date) -> datetime:
    return datetime.combine(value, time.min).replace(tzinfo=timezone.utc)


def _date_end(value: date) -> datetime:
    return datetime.combine(value + timedelta(days=1), time.min).replace(tzinfo=timezone.utc)


@router.get("", response_model=list[IntakeFormListItem])
def list_intake_forms(
    urgency: Urgency | None = Query(default=None),
    date_from: date | None = None,
    date_to: date | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[IntakeFormListItem]:
    clinic_id = _clinic_id(current_user)
    query = (
        select(IntakeForm, Patient.first_name, Patient.last_name, Conversation.urgency)
        .outerjoin(Patient, IntakeForm.patient_id == Patient.id)
        .outerjoin(Conversation, IntakeForm.conversation_id == Conversation.id)
        .where(IntakeForm.clinic_id == clinic_id)
    )
    if urgency is not None:
        query = query.where(Conversation.urgency == urgency)
    if date_from is not None:
        query = query.where(IntakeForm.created_at >= _date_start(date_from))
    if date_to is not None:
        query = query.where(IntakeForm.created_at < _date_end(date_to))

    rows = db.execute(query.order_by(IntakeForm.created_at.desc())).all()
    items: list[IntakeFormListItem] = []
    for form, first_name, last_name, form_urgency in rows:
        patient_name = f"{first_name or ''} {last_name or ''}".strip() or None
        items.append(
            IntakeFormListItem(
                id=form.id,
                patient_id=form.patient_id,
                patient_name=patient_name,
                conversation_id=form.conversation_id,
                reason_for_visit=form.reason_for_visit,
                insurance_provider=form.insurance_provider,
                preferred_date=form.preferred_date,
                preferred_time=form.preferred_time,
                symptoms=form.symptoms,
                ai_summary=form.ai_summary,
                missing_fields=form.missing_fields or [],
                urgency=form_urgency,
                created_at=form.created_at,
            )
        )
    return items
