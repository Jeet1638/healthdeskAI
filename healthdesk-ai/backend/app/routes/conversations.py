from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.all_models import Conversation, Message, Patient, User
from app.schemas.all_schemas import (
    AISummaryResponse,
    ConversationDetailResponse,
    ConversationListItem,
    ConversationPatientResponse,
    ConversationRead,
    ConversationStartRequest,
    MessageRead,
    StaffMessageRequest,
)
from app.services import ai_service
from app.services.ai_service import AIServiceError


router = APIRouter(prefix="/conversations", tags=["conversations"])


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _current_clinic_id(current_user: User) -> UUID:
    if current_user.clinic_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Current user is not linked to a clinic",
        )
    return current_user.clinic_id


def _get_conversation_for_user(
    db: Session,
    conversation_id: UUID,
    current_user: User,
) -> Conversation:
    clinic_id = _current_clinic_id(current_user)
    conversation = (
        db.execute(
            select(Conversation).where(
                Conversation.id == conversation_id,
                Conversation.clinic_id == clinic_id,
            )
        )
        .scalars()
        .first()
    )
    if conversation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )
    return conversation


def _patient_response(patient: Patient | None) -> ConversationPatientResponse | None:
    if patient is None:
        return None
    return ConversationPatientResponse(
        id=patient.id,
        first_name=patient.first_name,
        last_name=patient.last_name,
        email=patient.email,
        phone=patient.phone,
        new_patient=patient.new_patient,
    )


def _message_list(db: Session, conversation_id: UUID) -> list[Message]:
    return (
        db.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at, Message.id)
        )
        .scalars()
        .all()
    )


@router.get("", response_model=list[ConversationListItem])
def list_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ConversationListItem]:
    clinic_id = _current_clinic_id(current_user)
    rows = db.execute(
        select(
            Conversation,
            Patient.first_name,
            Patient.last_name,
            func.count(Message.id).label("message_count"),
        )
        .outerjoin(Patient, Conversation.patient_id == Patient.id)
        .outerjoin(Message, Conversation.id == Message.conversation_id)
        .where(Conversation.clinic_id == clinic_id)
        .group_by(Conversation.id, Patient.first_name, Patient.last_name)
        .order_by(Conversation.updated_at.desc())
    ).all()

    items: list[ConversationListItem] = []
    for conversation, first_name, last_name, message_count in rows:
        patient_name = None
        if first_name or last_name:
            patient_name = f"{first_name or ''} {last_name or ''}".strip()
        items.append(
            ConversationListItem(
                id=conversation.id,
                channel=conversation.channel,
                status=conversation.status,
                category=conversation.category,
                urgency=conversation.urgency,
                summary=conversation.summary,
                created_at=conversation.created_at,
                updated_at=conversation.updated_at,
                patient_name=patient_name,
                message_count=message_count,
            )
        )
    return items


@router.post("", response_model=ConversationRead)
def create_conversation(
    payload: ConversationStartRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Conversation:
    clinic_id = _current_clinic_id(current_user)
    if payload.patient_id is not None:
        patient = (
            db.execute(
                select(Patient).where(
                    Patient.id == payload.patient_id,
                    Patient.clinic_id == clinic_id,
                )
            )
            .scalars()
            .first()
        )
        if patient is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Patient not found",
            )

    conversation = Conversation(
        clinic_id=clinic_id,
        patient_id=payload.patient_id,
        channel=payload.channel,
        status="open",
        urgency="low",
    )
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation


@router.get("/{conversation_id}", response_model=ConversationDetailResponse)
def get_conversation(
    conversation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ConversationDetailResponse:
    conversation = _get_conversation_for_user(db, conversation_id, current_user)
    messages = _message_list(db, conversation.id)
    return ConversationDetailResponse(
        id=conversation.id,
        clinic_id=conversation.clinic_id,
        patient_id=conversation.patient_id,
        channel=conversation.channel,
        status=conversation.status,
        category=conversation.category,
        urgency=conversation.urgency,
        summary=conversation.summary,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
        patient=_patient_response(conversation.patient),
        messages=[MessageRead.model_validate(message) for message in messages],
    )


@router.post("/{conversation_id}/message", response_model=MessageRead)
def add_staff_message(
    conversation_id: UUID,
    payload: StaffMessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Message:
    conversation = _get_conversation_for_user(db, conversation_id, current_user)
    conversation.updated_at = utc_now()
    message = Message(
        conversation_id=conversation.id,
        sender="staff",
        content=payload.content,
    )
    db.add(conversation)
    db.add(message)
    db.commit()
    db.refresh(message)
    return message


@router.post("/{conversation_id}/summarize", response_model=AISummaryResponse)
async def summarize_conversation(
    conversation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AISummaryResponse:
    conversation = _get_conversation_for_user(db, conversation_id, current_user)
    messages = _message_list(db, conversation.id)
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
