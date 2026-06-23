from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.all_models import Clinic, User
from app.schemas.all_schemas import ClinicResponse, ClinicUpdate


router = APIRouter(prefix="/clinics", tags=["clinics"])


def get_current_user_clinic(current_user: User, db: Session) -> Clinic:
    if current_user.clinic_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Current user is not linked to a clinic",
        )
    clinic = db.execute(
        select(Clinic).where(Clinic.id == current_user.clinic_id)
    ).scalars().first()
    if clinic is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Clinic not found",
        )
    return clinic


@router.get("/me", response_model=ClinicResponse)
def read_my_clinic(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Clinic:
    return get_current_user_clinic(current_user, db)


@router.patch("/me", response_model=ClinicResponse)
def update_my_clinic(
    payload: ClinicUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Clinic:
    clinic = get_current_user_clinic(current_user, db)
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(clinic, field, value)
    db.add(clinic)
    db.commit()
    db.refresh(clinic)
    return clinic
