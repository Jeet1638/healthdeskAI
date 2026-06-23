from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.all_models import Appointment, Conversation, Escalation, IntakeForm, User
from app.schemas.all_schemas import (
    AnalyticsOverviewResponse,
    AppointmentStatusCountItem,
    CommonQuestionItem,
    InquiriesByDayItem,
    PeakHourItem,
)


router = APIRouter(prefix="/analytics", tags=["analytics"])

APPOINTMENT_STATUSES = ["scheduled", "rescheduled", "cancelled", "completed", "no_show"]


def _clinic_id(current_user: User) -> UUID:
    if current_user.clinic_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Current user is not linked to a clinic",
        )
    return current_user.clinic_id


@router.get("/overview", response_model=AnalyticsOverviewResponse)
def overview(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AnalyticsOverviewResponse:
    clinic_id = _clinic_id(current_user)
    total_conversations = db.execute(
        select(func.count(Conversation.id)).where(Conversation.clinic_id == clinic_id)
    ).scalar_one()
    booked_appointments = db.execute(
        select(func.count(Appointment.id)).where(
            Appointment.clinic_id == clinic_id,
            Appointment.status.in_(["scheduled", "completed"]),
        )
    ).scalar_one()
    rescheduled_appointments = db.execute(
        select(func.count(Appointment.id)).where(
            Appointment.clinic_id == clinic_id,
            Appointment.status == "rescheduled",
        )
    ).scalar_one()
    cancelled_appointments = db.execute(
        select(func.count(Appointment.id)).where(
            Appointment.clinic_id == clinic_id,
            Appointment.status == "cancelled",
        )
    ).scalar_one()
    open_escalations = db.execute(
        select(func.count(Escalation.id)).where(
            Escalation.clinic_id == clinic_id,
            Escalation.status == "open",
        )
    ).scalar_one()

    missing_field_rows = (
        db.execute(select(IntakeForm.missing_fields).where(IntakeForm.clinic_id == clinic_id))
        .scalars()
        .all()
    )
    pending_intake_forms = sum(1 for fields in missing_field_rows if fields)

    appointment_patient_ids = (
        select(Appointment.patient_id)
        .where(Appointment.clinic_id == clinic_id)
        .distinct()
    )
    converted_conversations = db.execute(
        select(func.count(Conversation.id)).where(
            Conversation.clinic_id == clinic_id,
            Conversation.patient_id.is_not(None),
            Conversation.patient_id.in_(appointment_patient_ids),
        )
    ).scalar_one()
    booking_conversion_rate = (
        round((converted_conversations / total_conversations) * 100, 1)
        if total_conversations
        else 0.0
    )

    return AnalyticsOverviewResponse(
        total_conversations=total_conversations,
        booked_appointments=booked_appointments,
        rescheduled_appointments=rescheduled_appointments,
        cancelled_appointments=cancelled_appointments,
        open_escalations=open_escalations,
        pending_intake_forms=pending_intake_forms,
        booking_conversion_rate=booking_conversion_rate,
    )


@router.get("/inquiries-by-day", response_model=list[InquiriesByDayItem])
def inquiries_by_day(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[InquiriesByDayItem]:
    clinic_id = _clinic_id(current_user)
    today = datetime.now(timezone.utc).date()
    start_day = today - timedelta(days=29)
    rows = db.execute(
        select(func.date(Conversation.created_at).label("day"), func.count(Conversation.id))
        .where(
            Conversation.clinic_id == clinic_id,
            Conversation.created_at >= datetime.combine(start_day, datetime.min.time()).replace(tzinfo=timezone.utc),
        )
        .group_by("day")
    ).all()
    counts = {str(day): count for day, count in rows}
    return [
        InquiriesByDayItem(date=str(start_day + timedelta(days=offset)), count=counts.get(str(start_day + timedelta(days=offset)), 0))
        for offset in range(30)
    ]


@router.get("/appointment-status", response_model=list[AppointmentStatusCountItem])
def appointment_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[AppointmentStatusCountItem]:
    clinic_id = _clinic_id(current_user)
    rows = db.execute(
        select(Appointment.status, func.count(Appointment.id))
        .where(Appointment.clinic_id == clinic_id)
        .group_by(Appointment.status)
    ).all()
    counts = {status_name: count for status_name, count in rows}
    return [
        AppointmentStatusCountItem(status=status_name, count=counts.get(status_name, 0))
        for status_name in APPOINTMENT_STATUSES
    ]


@router.get("/common-questions", response_model=list[CommonQuestionItem])
def common_questions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[CommonQuestionItem]:
    clinic_id = _clinic_id(current_user)
    rows = db.execute(
        select(func.coalesce(Conversation.category, "uncategorized"), func.count(Conversation.id))
        .where(Conversation.clinic_id == clinic_id)
        .group_by(func.coalesce(Conversation.category, "uncategorized"))
        .order_by(func.count(Conversation.id).desc())
        .limit(5)
    ).all()
    return [CommonQuestionItem(category=category, count=count) for category, count in rows]


@router.get("/peak-hours", response_model=list[PeakHourItem])
def peak_hours(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[PeakHourItem]:
    clinic_id = _clinic_id(current_user)
    hour_expr = func.extract("hour", Conversation.created_at)
    rows = db.execute(
        select(hour_expr.label("hour"), func.count(Conversation.id))
        .where(Conversation.clinic_id == clinic_id)
        .group_by("hour")
    ).all()
    counts = {int(hour): count for hour, count in rows}
    return [PeakHourItem(hour=hour, count=counts.get(hour, 0)) for hour in range(24)]
