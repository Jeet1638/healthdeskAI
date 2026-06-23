import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import (
    create_user_access_token,
    get_current_user,
    get_password_hash,
    verify_password,
)
from app.models.all_models import Clinic, User
from app.schemas.all_schemas import (
    GoogleAuthRequest,
    TokenResponse,
    UserCreate,
    UserLogin,
    UserResponse,
    UserWithClinicResponse,
)


router = APIRouter(prefix="/auth", tags=["auth"])


def user_to_response(user: User) -> UserResponse:
    return UserResponse.model_validate(user)


def token_response_for_user(user: User) -> TokenResponse:
    return TokenResponse(
        access_token=create_user_access_token(user),
        token_type="bearer",
        user=user_to_response(user),
    )


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.execute(select(User).where(User.email == email.lower())).scalars().first()


@router.post("/register", response_model=TokenResponse)
def register(payload: UserCreate, db: Session = Depends(get_db)) -> TokenResponse:
    email = payload.email.lower()
    if get_user_by_email(db, email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already registered",
        )

    clinic = Clinic(name=payload.clinic_name, timezone="America/Phoenix", opening_hours={})
    user = User(
        name=payload.name,
        email=email,
        password_hash=get_password_hash(payload.password),
        role=payload.role,
        clinic=clinic,
    )
    db.add(clinic)
    db.add(user)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already registered",
        ) from exc

    db.refresh(user)
    return token_response_for_user(user)


@router.post("/login", response_model=TokenResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)) -> TokenResponse:
    user = get_user_by_email(db, payload.email)
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return token_response_for_user(user)


@router.post("/google", response_model=TokenResponse)
async def google_signin(
    payload: GoogleAuthRequest,
    db: Session = Depends(get_db),
) -> TokenResponse:
    try:
        idinfo = id_token.verify_oauth2_token(
            payload.id_token,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Google token: {str(exc)}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    google_id = str(idinfo.get("sub") or "").strip()
    email = str(idinfo.get("email") or "").lower()
    name = str(idinfo.get("name") or email).strip()
    email_verified = idinfo.get("email_verified", False) is True

    if not email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account email is not verified",
        )

    if not email or not google_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not extract user info from Google token",
        )

    user = (
        db.execute(
            select(User).where(or_(User.google_id == google_id, User.email == email))
        )
        .scalars()
        .first()
    )

    if user:
        if user.google_id and user.google_id != google_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Google account is already linked to another user",
            )
        if not user.google_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This email is already registered with a password. Please log in with your email and password.",
            )
    else:
        clinic = Clinic(
            name=f"{name}'s Clinic",
            timezone="America/Phoenix",
            opening_hours={},
        )
        user = User(
            name=name,
            email=email,
            google_id=google_id,
            role="admin",
            password_hash=get_password_hash(secrets.token_urlsafe(32)),
            clinic=clinic,
        )
        db.add(clinic)
        db.add(user)

    if user.clinic_id is None and user.clinic is None:
        user.clinic = Clinic(
            name=f"{name}'s Clinic",
            timezone="America/Phoenix",
            opening_hours={},
        )

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account could not be linked",
        ) from exc

    db.refresh(user)
    return token_response_for_user(user)


@router.get("/me", response_model=UserWithClinicResponse)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.post("/logout")
def logout() -> dict[str, str]:
    return {"message": "logged out"}
