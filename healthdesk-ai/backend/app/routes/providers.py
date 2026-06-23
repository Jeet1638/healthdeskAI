from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.all_models import Provider, User
from app.schemas.all_schemas import ProviderCreateRequest, ProviderOptionResponse, ProviderUpdate


router = APIRouter(prefix="/providers", tags=["providers"])


def _clinic_id(current_user: User) -> UUID:
    if current_user.clinic_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Current user is not linked to a clinic",
        )
    return current_user.clinic_id


@router.get("", response_model=list[ProviderOptionResponse])
def list_providers(
    active: bool | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ProviderOptionResponse]:
    clinic_id = _clinic_id(current_user)
    query = select(Provider).where(Provider.clinic_id == clinic_id)
    if active is not None:
        query = query.where(Provider.active.is_(active))

    providers = db.execute(query.order_by(Provider.name)).scalars().all()
    return [
        ProviderOptionResponse(
            id=provider.id,
            name=provider.name,
            specialty=provider.specialty,
            email=provider.email,
            active=provider.active,
        )
        for provider in providers
    ]


def _get_provider(db: Session, provider_id: UUID, clinic_id: UUID) -> Provider:
    provider = (
        db.execute(
            select(Provider).where(
                Provider.id == provider_id,
                Provider.clinic_id == clinic_id,
            )
        )
        .scalars()
        .first()
    )
    if provider is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")
    return provider


def _provider_response(provider: Provider) -> ProviderOptionResponse:
    return ProviderOptionResponse(
        id=provider.id,
        name=provider.name,
        specialty=provider.specialty,
        email=provider.email,
        active=provider.active,
    )


@router.post("", response_model=ProviderOptionResponse)
def create_provider(
    payload: ProviderCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProviderOptionResponse:
    clinic_id = _clinic_id(current_user)
    provider = Provider(
        clinic_id=clinic_id,
        name=payload.name,
        specialty=payload.specialty,
        email=payload.email,
        active=True,
    )
    db.add(provider)
    db.commit()
    db.refresh(provider)
    return _provider_response(provider)


@router.patch("/{provider_id}", response_model=ProviderOptionResponse)
def update_provider(
    provider_id: UUID,
    payload: ProviderUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProviderOptionResponse:
    clinic_id = _clinic_id(current_user)
    provider = _get_provider(db, provider_id, clinic_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(provider, key, value)
    db.add(provider)
    db.commit()
    db.refresh(provider)
    return _provider_response(provider)


@router.delete("/{provider_id}", response_model=ProviderOptionResponse)
def delete_provider(
    provider_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProviderOptionResponse:
    clinic_id = _clinic_id(current_user)
    provider = _get_provider(db, provider_id, clinic_id)
    provider.active = False
    db.add(provider)
    db.commit()
    db.refresh(provider)
    return _provider_response(provider)
