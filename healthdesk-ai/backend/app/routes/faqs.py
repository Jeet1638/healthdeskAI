from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.all_models import FAQ, User
from app.schemas.all_schemas import FAQCreateRequest, FAQSettingsResponse, FAQUpdate


router = APIRouter(prefix="/faqs", tags=["faqs"])


def _clinic_id(current_user: User) -> UUID:
    if current_user.clinic_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Current user is not linked to a clinic",
        )
    return current_user.clinic_id


def _faq_response(faq: FAQ) -> FAQSettingsResponse:
    return FAQSettingsResponse(
        id=faq.id,
        question=faq.question,
        answer=faq.answer,
        category=faq.category,
        active=faq.active,
        created_at=faq.created_at,
    )


def _get_faq(db: Session, faq_id: UUID, clinic_id: UUID) -> FAQ:
    faq = (
        db.execute(select(FAQ).where(FAQ.id == faq_id, FAQ.clinic_id == clinic_id))
        .scalars()
        .first()
    )
    if faq is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="FAQ not found")
    return faq


@router.get("", response_model=list[FAQSettingsResponse])
def list_faqs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[FAQSettingsResponse]:
    clinic_id = _clinic_id(current_user)
    faqs = (
        db.execute(
            select(FAQ)
            .where(FAQ.clinic_id == clinic_id)
            .order_by(FAQ.created_at.desc(), FAQ.id.desc())
        )
        .scalars()
        .all()
    )
    return [_faq_response(faq) for faq in faqs]


@router.post("", response_model=FAQSettingsResponse)
def create_faq(
    payload: FAQCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FAQSettingsResponse:
    clinic_id = _clinic_id(current_user)
    faq = FAQ(
        clinic_id=clinic_id,
        question=payload.question,
        answer=payload.answer,
        category=payload.category,
        active=payload.active,
    )
    db.add(faq)
    db.commit()
    db.refresh(faq)
    return _faq_response(faq)


@router.patch("/{faq_id}", response_model=FAQSettingsResponse)
def update_faq(
    faq_id: UUID,
    payload: FAQUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FAQSettingsResponse:
    clinic_id = _clinic_id(current_user)
    faq = _get_faq(db, faq_id, clinic_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(faq, key, value)
    db.add(faq)
    db.commit()
    db.refresh(faq)
    return _faq_response(faq)


@router.delete("/{faq_id}", response_model=dict[str, str])
def delete_faq(
    faq_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    clinic_id = _clinic_id(current_user)
    faq = _get_faq(db, faq_id, clinic_id)
    db.delete(faq)
    db.commit()
    return {"message": "FAQ deleted"}
