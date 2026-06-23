import asyncio
import time
import traceback
from contextlib import suppress

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi import _rate_limit_exceeded_handler

from app.core.config import settings
from app.core.rate_limit import limiter
from app.routes.ai import router as ai_router
from app.routes.analytics import router as analytics_router
from app.routes.appointments import router as appointments_router
from app.routes.auth import router as auth_router
from app.routes.clinics import router as clinics_router
from app.routes.conversations import router as conversations_router
from app.routes.faqs import router as faqs_router
from app.routes.intake_forms import router as intake_forms_router
from app.routes.patients import router as patients_router
from app.routes.providers import router as providers_router
from app.routes.services import router as services_router
from app.services.reminder_service import appointment_reminder_scheduler


app = FastAPI(title="HealthDesk AI")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

allowed_origins = sorted(
    origin
    for origin in {
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        *[url.strip() for url in settings.FRONTEND_URL.split(",")],
    }
    if origin
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def start_appointment_reminders() -> None:
    app.state.reminder_stop_event = asyncio.Event()
    app.state.reminder_task = asyncio.create_task(
        appointment_reminder_scheduler(app.state.reminder_stop_event)
    )


@app.on_event("shutdown")
async def stop_appointment_reminders() -> None:
    stop_event = getattr(app.state, "reminder_stop_event", None)
    reminder_task = getattr(app.state, "reminder_task", None)
    if stop_event is not None:
        stop_event.set()
    if reminder_task is not None:
        reminder_task.cancel()
        with suppress(asyncio.CancelledError):
            await reminder_task


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    started_at = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = round((time.perf_counter() - started_at) * 1000)
    print(f"{request.method} {request.url.path} {response.status_code} {elapsed_ms}ms")
    return response


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": str(exc)},
    )


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "HealthDesk AI"}


@app.get("/api/v1")
def api_v1_root() -> dict[str, str]:
    return {"message": "HealthDesk AI API v1"}


app.include_router(auth_router, prefix="/api/v1")
app.include_router(clinics_router, prefix="/api/v1")
app.include_router(ai_router, prefix="/api/v1")
app.include_router(conversations_router, prefix="/api/v1")
app.include_router(appointments_router, prefix="/api/v1")
app.include_router(patients_router, prefix="/api/v1")
app.include_router(analytics_router, prefix="/api/v1")
app.include_router(intake_forms_router, prefix="/api/v1")
app.include_router(providers_router, prefix="/api/v1")
app.include_router(services_router, prefix="/api/v1")
app.include_router(faqs_router, prefix="/api/v1")
