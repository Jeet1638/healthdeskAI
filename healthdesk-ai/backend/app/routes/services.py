from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.all_models import Service, User
from app.schemas.all_schemas import ServiceCreateRequest, ServiceOptionResponse, ServiceUpdate


router = APIRouter(prefix="/services", tags=["services"])


def _clinic_id(current_user: User) -> UUID:
    if current_user.clinic_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Current user is not linked to a clinic",
        )
    return current_user.clinic_id


@router.get("", response_model=list[ServiceOptionResponse])
def list_services(
    active: bool | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ServiceOptionResponse]:
    clinic_id = _clinic_id(current_user)
    query = select(Service).where(Service.clinic_id == clinic_id)
    if active is not None:
        query = query.where(Service.active.is_(active))

    services = db.execute(query.order_by(Service.name)).scalars().all()
    return [
        ServiceOptionResponse(
            id=service.id,
            name=service.name,
            description=service.description,
            duration_minutes=service.duration_minutes,
            active=service.active,
        )
        for service in services
    ]


def _get_service(db: Session, service_id: UUID, clinic_id: UUID) -> Service:
    service = (
        db.execute(
            select(Service).where(
                Service.id == service_id,
                Service.clinic_id == clinic_id,
            )
        )
        .scalars()
        .first()
    )
    if service is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")
    return service


def _service_response(service: Service) -> ServiceOptionResponse:
    return ServiceOptionResponse(
        id=service.id,
        name=service.name,
        description=service.description,
        duration_minutes=service.duration_minutes,
        active=service.active,
    )


@router.post("", response_model=ServiceOptionResponse)
def create_service(
    payload: ServiceCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ServiceOptionResponse:
    clinic_id = _clinic_id(current_user)
    service = Service(
        clinic_id=clinic_id,
        name=payload.name,
        description=payload.description,
        duration_minutes=payload.duration_minutes,
        active=True,
    )
    db.add(service)
    db.commit()
    db.refresh(service)
    return _service_response(service)


@router.patch("/{service_id}", response_model=ServiceOptionResponse)
def update_service(
    service_id: UUID,
    payload: ServiceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ServiceOptionResponse:
    clinic_id = _clinic_id(current_user)
    service = _get_service(db, service_id, clinic_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(service, key, value)
    db.add(service)
    db.commit()
    db.refresh(service)
    return _service_response(service)


@router.delete("/{service_id}", response_model=ServiceOptionResponse)
def delete_service(
    service_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ServiceOptionResponse:
    clinic_id = _clinic_id(current_user)
    service = _get_service(db, service_id, clinic_id)
    service.active = False
    db.add(service)
    db.commit()
    db.refresh(service)
    return _service_response(service)
