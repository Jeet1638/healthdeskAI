from __future__ import annotations

import os
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.all_models import AppointmentSlot, Clinic, FAQ, Provider, Service


TARGET_CLINIC_NAME = os.getenv("TARGET_CLINIC_NAME", "Jeet Patel's Clinic").strip()
DESIRED_OPEN_SLOTS = int(os.getenv("TARGET_OPEN_SLOTS", "260"))

DEFAULT_OPENING_HOURS = {
    "monday": "8am-5pm",
    "tuesday": "8am-5pm",
    "wednesday": "8am-5pm",
    "thursday": "8am-5pm",
    "friday": "8am-5pm",
    "saturday": "9am-1pm",
    "sunday": "closed",
}

PROVIDERS = [
    {
        "name": "Dr. Priya Shah",
        "specialty": "General Practice",
        "email": "priya.shah@jeetpatelclinic.com",
    },
    {
        "name": "Dr. Ethan Brooks",
        "specialty": "Family Medicine",
        "email": "ethan.brooks@jeetpatelclinic.com",
    },
    {
        "name": "Dr. Maya Hernandez",
        "specialty": "Pediatrics",
        "email": "maya.hernandez@jeetpatelclinic.com",
    },
    {
        "name": "Dr. Olivia Kim",
        "specialty": "Physical Therapy",
        "email": "olivia.kim@jeetpatelclinic.com",
    },
]

SERVICES = [
    {
        "name": "OPD",
        "description": "General outpatient visit for routine concerns and follow-ups.",
        "duration_minutes": 30,
    },
    {
        "name": "General Checkup",
        "description": "Routine wellness visit, preventive screening, and general health review.",
        "duration_minutes": 30,
    },
    {
        "name": "Follow-up Visit",
        "description": "Follow-up appointment for an existing concern, medication check, or care plan review.",
        "duration_minutes": 20,
    },
    {
        "name": "New Patient Visit",
        "description": "First visit for a new patient, including history, intake, and care setup.",
        "duration_minutes": 45,
    },
    {
        "name": "Pediatric Consultation",
        "description": "Child and adolescent visit for routine care, school forms, and common concerns.",
        "duration_minutes": 30,
    },
    {
        "name": "Physical Therapy Consultation",
        "description": "Initial physical therapy evaluation and recovery planning.",
        "duration_minutes": 60,
    },
    {
        "name": "Vaccination Visit",
        "description": "Scheduled vaccination or immunization review appointment.",
        "duration_minutes": 20,
    },
    {
        "name": "Lab Results Review",
        "description": "Administrative visit to review lab result follow-up steps with clinic staff.",
        "duration_minutes": 20,
    },
    {
        "name": "Telehealth Visit",
        "description": "Virtual appointment for eligible follow-ups and clinic-approved visit types.",
        "duration_minutes": 30,
    },
]

FAQS = [
    {
        "question": "What are your clinic hours?",
        "answer": "Jeet Patel's Clinic is open Monday through Friday from 8am to 5pm and Saturday from 9am to 1pm. The clinic is closed on Sunday.",
        "category": "hours",
    },
    {
        "question": "Do you accept new patients?",
        "answer": "Yes, Jeet Patel's Clinic accepts new patients. New patients should bring a photo ID, insurance card, medication list, and any recent medical records.",
        "category": "new_patients",
    },
    {
        "question": "What insurance do you accept?",
        "answer": "The clinic accepts many major insurance plans. Patients should share their insurance provider when requesting an appointment so staff can verify coverage.",
        "category": "insurance",
    },
    {
        "question": "What should I bring to my appointment?",
        "answer": "Please bring a photo ID, insurance card, current medication list, any recent test results, and completed intake information if available.",
        "category": "appointment_prep",
    },
    {
        "question": "How do I reschedule an appointment?",
        "answer": "Patients can reschedule through the assistant by providing their name, email, phone number, and preferred new date or time. Clinic staff can also help by phone.",
        "category": "rescheduling",
    },
    {
        "question": "What is your cancellation policy?",
        "answer": "Please cancel or reschedule at least 24 hours before your appointment whenever possible so the clinic can offer the time to another patient.",
        "category": "cancellations",
    },
    {
        "question": "Where should I park?",
        "answer": "Patient parking is available near the clinic entrance. Please arrive a few minutes early to allow time for parking and check-in.",
        "category": "parking",
    },
    {
        "question": "Do you offer telehealth appointments?",
        "answer": "Yes, telehealth visits are available for eligible appointment types. The assistant can collect your request and clinic staff will confirm if telehealth is appropriate.",
        "category": "telehealth",
    },
    {
        "question": "Do I need a referral?",
        "answer": "Some visit types or insurance plans may require a referral. Please share your reason for visit and insurance provider so staff can confirm requirements.",
        "category": "referrals",
    },
    {
        "question": "How do I get lab results?",
        "answer": "Clinic staff will contact patients when lab results are ready for review. You can also request a lab results review appointment through the assistant.",
        "category": "lab_results",
    },
    {
        "question": "Can I request medication refills?",
        "answer": "Patients can ask the assistant to route a refill request to staff. Please include your name, phone number, medication name, and preferred pharmacy.",
        "category": "medications",
    },
]

WEEKDAY_SLOT_TIMES = [
    time(9, 0),
    time(9, 30),
    time(10, 0),
    time(10, 30),
    time(11, 0),
    time(14, 0),
    time(14, 30),
    time(15, 0),
    time(15, 30),
]
SATURDAY_SLOT_TIMES = [time(9, 0), time(9, 30), time(10, 0), time(10, 30)]


def find_clinic(db: Session) -> Clinic:
    lookup_names = {
        TARGET_CLINIC_NAME,
        TARGET_CLINIC_NAME.replace("'", ""),
        "Jeet Patel's Clinic",
        "Jeet Patel Clinic",
    }

    clinic = db.execute(
        select(Clinic).where(func.lower(Clinic.name).in_([name.lower() for name in lookup_names]))
    ).scalars().first()

    if clinic:
        return clinic

    clinic = db.execute(
        select(Clinic).where(func.lower(Clinic.name).like("%jeet%patel%clinic%"))
    ).scalars().first()

    if clinic:
        return clinic

    available = db.execute(select(Clinic.name).order_by(Clinic.created_at.desc())).scalars().all()
    available_text = ", ".join(available) if available else "no clinics found"
    raise RuntimeError(
        f"Could not find clinic named {TARGET_CLINIC_NAME!r}. Available clinics: {available_text}"
    )


def configure_clinic(clinic: Clinic) -> bool:
    changed = False
    if not clinic.timezone:
        clinic.timezone = "America/Phoenix"
        changed = True
    if not clinic.opening_hours:
        clinic.opening_hours = DEFAULT_OPENING_HOURS
        changed = True
    if not clinic.email_notifications_appointments:
        clinic.email_notifications_appointments = True
        changed = True
    if not clinic.email_notifications_escalation:
        clinic.email_notifications_escalation = True
        changed = True
    return changed


def upsert_providers(db: Session, clinic: Clinic) -> tuple[list[Provider], int, int]:
    providers: list[Provider] = []
    added = 0
    updated = 0

    for item in PROVIDERS:
        provider = db.execute(
            select(Provider).where(
                Provider.clinic_id == clinic.id,
                func.lower(Provider.email) == item["email"].lower(),
            )
        ).scalars().first()

        if provider is None:
            provider = Provider(clinic_id=clinic.id, **item, active=True)
            db.add(provider)
            added += 1
        else:
            for key, value in item.items():
                setattr(provider, key, value)
            provider.active = True
            updated += 1
        providers.append(provider)

    db.flush()
    return providers, added, updated


def upsert_services(db: Session, clinic: Clinic) -> tuple[int, int]:
    added = 0
    updated = 0

    for item in SERVICES:
        service = db.execute(
            select(Service).where(
                Service.clinic_id == clinic.id,
                func.lower(Service.name) == item["name"].lower(),
            )
        ).scalars().first()

        if service is None:
            db.add(Service(clinic_id=clinic.id, **item, active=True))
            added += 1
        else:
            for key, value in item.items():
                setattr(service, key, value)
            service.active = True
            updated += 1

    return added, updated


def upsert_faqs(db: Session, clinic: Clinic) -> tuple[int, int]:
    added = 0
    updated = 0

    for item in FAQS:
        faq = db.execute(
            select(FAQ).where(
                FAQ.clinic_id == clinic.id,
                func.lower(FAQ.question) == item["question"].lower(),
            )
        ).scalars().first()

        if faq is None:
            db.add(FAQ(clinic_id=clinic.id, **item, active=True))
            added += 1
        else:
            for key, value in item.items():
                setattr(faq, key, value)
            faq.active = True
            updated += 1

    return added, updated


def clinic_zone(clinic: Clinic) -> ZoneInfo:
    try:
        return ZoneInfo(clinic.timezone or "America/Phoenix")
    except ZoneInfoNotFoundError:
        clinic.timezone = "America/Phoenix"
        return ZoneInfo("America/Phoenix")


def count_future_open_slots(db: Session, clinic: Clinic, today: date, tz: ZoneInfo) -> int:
    start_of_today = datetime.combine(today, time.min, tzinfo=tz)
    return db.execute(
        select(func.count(AppointmentSlot.id)).where(
            AppointmentSlot.clinic_id == clinic.id,
            AppointmentSlot.is_booked.is_(False),
            AppointmentSlot.start_time >= start_of_today,
        )
    ).scalar_one()


def create_slots(db: Session, clinic: Clinic, providers: list[Provider]) -> tuple[int, int]:
    tz = clinic_zone(clinic)
    today = datetime.now(tz).date()
    existing_open = count_future_open_slots(db, clinic, today, tz)
    slots_needed = max(DESIRED_OPEN_SLOTS - existing_open, 0)

    if slots_needed == 0:
        return 0, existing_open

    added = 0
    cursor = today + timedelta(days=1)
    max_days_to_scan = 90

    for day_offset in range(max_days_to_scan):
        if added >= slots_needed:
            break

        current_day = cursor + timedelta(days=day_offset)
        weekday = current_day.weekday()
        if weekday == 6:
            continue

        slot_times = SATURDAY_SLOT_TIMES if weekday == 5 else WEEKDAY_SLOT_TIMES
        for index, slot_time in enumerate(slot_times):
            if added >= slots_needed:
                break

            provider = providers[(day_offset + index) % len(providers)]
            start_at = datetime.combine(current_day, slot_time, tzinfo=tz)
            end_at = start_at + timedelta(minutes=30)

            duplicate = db.execute(
                select(AppointmentSlot.id).where(
                    AppointmentSlot.provider_id == provider.id,
                    AppointmentSlot.start_time == start_at,
                )
            ).scalar_one_or_none()

            if duplicate:
                continue

            db.add(
                AppointmentSlot(
                    clinic_id=clinic.id,
                    provider_id=provider.id,
                    start_time=start_at,
                    end_time=end_at,
                    is_booked=False,
                )
            )
            added += 1

    return added, existing_open + added


def main() -> None:
    db = SessionLocal()
    try:
        clinic = find_clinic(db)
        clinic_updated = configure_clinic(clinic)
        providers, providers_added, providers_updated = upsert_providers(db, clinic)
        services_added, services_updated = upsert_services(db, clinic)
        faqs_added, faqs_updated = upsert_faqs(db, clinic)
        slots_added, future_open_slots = create_slots(db, clinic, providers)
        db.commit()

        print(f"Clinic setup complete: {clinic.name}")
        print(f"Clinic settings updated: {clinic_updated}")
        print(f"Providers added: {providers_added}, updated: {providers_updated}")
        print(f"Services added: {services_added}, updated: {services_updated}")
        print(f"FAQs added: {faqs_added}, updated: {faqs_updated}")
        print(f"Open appointment slots added: {slots_added}")
        print(f"Future open appointment slots now available: {future_open_slots}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
