from __future__ import annotations

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models.all_models import (
    Appointment,
    AppointmentSlot,
    Clinic,
    Conversation,
    Escalation,
    FAQ,
    IntakeForm,
    Message,
    Patient,
    Provider,
    Service,
    User,
)


PHOENIX_TZ = ZoneInfo("America/Phoenix")

OPENING_HOURS = {
    "monday": "8am-5pm",
    "tuesday": "8am-5pm",
    "wednesday": "8am-5pm",
    "thursday": "8am-5pm",
    "friday": "8am-5pm",
    "saturday": "9am-1pm",
    "sunday": "closed",
}

PROVIDER_DATA = [
    {
        "name": "Dr. Sarah Chen",
        "specialty": "General Practice",
        "email": "sarah.chen@sunrisefamilyclinic.example",
    },
    {
        "name": "Dr. Marcus Williams",
        "specialty": "Pediatrics",
        "email": "marcus.williams@sunrisefamilyclinic.example",
    },
    {
        "name": "Dr. Aisha Patel",
        "specialty": "Physical Therapy",
        "email": "aisha.patel@sunrisefamilyclinic.example",
    },
]

SERVICE_DATA = [
    {
        "name": "General Checkup",
        "description": "Routine wellness exam with vitals, medication review, and preventive care planning.",
        "duration_minutes": 30,
    },
    {
        "name": "Dental Cleaning",
        "description": "Preventive cleaning and oral health screening.",
        "duration_minutes": 45,
    },
    {
        "name": "Physical Therapy Consultation",
        "description": "Initial movement assessment and therapy plan discussion.",
        "duration_minutes": 60,
    },
    {
        "name": "New Patient Visit",
        "description": "Comprehensive intake visit for patients new to the clinic.",
        "duration_minutes": 45,
    },
    {
        "name": "Follow-up Visit",
        "description": "Short visit to review progress, results, or medication changes.",
        "duration_minutes": 20,
    },
]

PATIENT_DATA = [
    ("Olivia", "Martinez", "olivia.martinez@example.com", "602-555-0101", date(1988, 4, 12), False),
    ("Ethan", "Johnson", "ethan.johnson@example.com", "602-555-0102", date(2016, 8, 3), True),
    ("Mia", "Garcia", "mia.garcia@example.com", "602-555-0103", date(1994, 11, 19), False),
    ("Noah", "Anderson", "noah.anderson@example.com", "602-555-0104", date(1979, 1, 27), False),
    ("Ava", "Thompson", "ava.thompson@example.com", "602-555-0105", date(2001, 6, 9), True),
    ("Liam", "Robinson", "liam.robinson@example.com", "602-555-0106", date(1990, 2, 21), False),
    ("Sophia", "Nguyen", "sophia.nguyen@example.com", "602-555-0107", date(1983, 9, 14), False),
    ("Jackson", "Brown", "jackson.brown@example.com", "602-555-0108", date(2013, 12, 5), True),
    ("Isabella", "Davis", "isabella.davis@example.com", "602-555-0109", date(1968, 7, 30), False),
    ("Lucas", "Miller", "lucas.miller@example.com", "602-555-0110", date(1997, 3, 17), True),
]

APPOINTMENT_REASONS = [
    "Annual wellness visit",
    "Pediatric fever follow-up",
    "Knee pain after running",
    "Medication review",
    "New patient intake",
    "Back stiffness consultation",
    "Blood pressure follow-up",
    "School physical",
    "Review recent lab results",
    "Post-therapy progress check",
]

CONVERSATION_DATA = [
    ("chat", "appointment", "low", "Patient asked about next available checkup slots."),
    ("voice", "insurance", "medium", "Caller wanted to confirm accepted insurance plans."),
    ("chat", "symptoms", "high", "Patient reported persistent chest tightness and requested guidance."),
    ("voice", "rescheduling", "low", "Patient needed to move an existing appointment."),
    ("chat", "new_patient", "medium", "Prospective patient asked how to establish care."),
    ("voice", "lab_results", "medium", "Patient asked when recent lab results would be available."),
    ("chat", "billing", "low", "Patient asked about a copay statement."),
    ("voice", "pediatrics", "medium", "Parent asked about same-day pediatric availability."),
    ("chat", "referral", "low", "Patient requested referral process details."),
    ("voice", "medication", "high", "Patient reported side effects after a medication change."),
    ("chat", "hours", "low", "Patient asked whether Saturday appointments are available."),
    ("voice", "telehealth", "low", "Caller asked if follow-up visits can be virtual."),
    ("chat", "emergency", "emergency", "Patient described severe symptoms needing immediate triage."),
    ("voice", "parking", "low", "Caller asked about accessible parking near the clinic."),
    ("chat", "cancellation", "low", "Patient asked about cancellation notice requirements."),
]

FAQ_DATA = [
    (
        "What are your clinic hours?",
        "Sunrise Family Clinic is open Monday through Friday from 8am to 5pm and Saturday from 9am to 1pm.",
        "hours",
    ),
    (
        "Are you accepting new patients?",
        "Yes. New patients can schedule a new patient visit and complete intake paperwork before arrival.",
        "new patients",
    ),
    (
        "What insurance do you accept?",
        "The clinic accepts many commercial plans, Medicare, and select marketplace plans. Please call with your member ID for verification.",
        "insurance",
    ),
    (
        "What should I bring to my appointment?",
        "Bring a photo ID, insurance card, current medication list, and any recent records or test results.",
        "what to bring",
    ),
    (
        "How do I reschedule an appointment?",
        "Call the front desk or use the patient portal to request a new time at least 24 hours before your visit.",
        "rescheduling",
    ),
    (
        "Where should I park?",
        "Free patient parking is available in the lot beside the clinic, with accessible spaces near the main entrance.",
        "parking",
    ),
    (
        "What is your cancellation policy?",
        "Please cancel or reschedule at least 24 hours in advance so the clinic can offer the time to another patient.",
        "cancellation policy",
    ),
    (
        "Do you offer telehealth visits?",
        "Telehealth is available for many follow-up visits, medication reviews, and result discussions when clinically appropriate.",
        "telehealth",
    ),
    (
        "Do I need a referral?",
        "Some specialty and therapy visits may require a referral depending on your insurance plan and the reason for care.",
        "referrals",
    ),
    (
        "How do I get lab results?",
        "Most lab results are posted to the patient portal after provider review, and urgent results are communicated directly.",
        "lab results",
    ),
]


def first_or_none(session: Session, statement):
    return session.execute(statement).scalars().first()


def count_for_clinic(session: Session, model, clinic_id) -> int:
    count = session.scalar(select(func.count()).select_from(model).where(model.clinic_id == clinic_id))
    return int(count or 0)


def ensure_demo_clinic(session: Session) -> Clinic:
    clinic = first_or_none(session, select(Clinic).where(Clinic.name == "Sunrise Family Clinic"))
    if clinic:
        return clinic

    clinic = Clinic(
        name="Sunrise Family Clinic",
        phone="602-555-0199",
        email="hello@sunrisefamilyclinic.example",
        address="1234 E Camelback Rd, Phoenix, AZ 85016",
        timezone="America/Phoenix",
        opening_hours=OPENING_HOURS,
    )
    session.add(clinic)
    session.flush()
    return clinic


def ensure_providers(session: Session, clinic: Clinic) -> list[Provider]:
    providers: list[Provider] = []
    for provider_data in PROVIDER_DATA:
        provider = first_or_none(
            session,
            select(Provider).where(
                Provider.clinic_id == clinic.id,
                Provider.email == provider_data["email"],
            ),
        )
        if provider is None:
            provider = Provider(clinic_id=clinic.id, active=True, **provider_data)
            session.add(provider)
            session.flush()
        providers.append(provider)
    return providers


def ensure_services(session: Session, clinic: Clinic) -> list[Service]:
    services: list[Service] = []
    for service_data in SERVICE_DATA:
        service = first_or_none(
            session,
            select(Service).where(
                Service.clinic_id == clinic.id,
                Service.name == service_data["name"],
            ),
        )
        if service is None:
            service = Service(clinic_id=clinic.id, active=True, **service_data)
            session.add(service)
            session.flush()
        services.append(service)
    return services


def ensure_demo_staff_user(session: Session, clinic: Clinic) -> User:
    user = first_or_none(session, select(User).where(User.email == "demo@healthdesk.ai"))
    if user:
        return user

    user = User(
        name="Demo Admin",
        email="demo@healthdesk.ai",
        password_hash=get_password_hash("Demo1234!"),
        role="admin",
        clinic_id=clinic.id,
    )
    session.add(user)
    session.flush()
    return user


def ensure_patients(session: Session, clinic: Clinic) -> list[Patient]:
    patients: list[Patient] = []
    for first_name, last_name, email, phone, dob, new_patient in PATIENT_DATA:
        patient = first_or_none(
            session,
            select(Patient).where(Patient.clinic_id == clinic.id, Patient.email == email),
        )
        if patient is None:
            patient = Patient(
                clinic_id=clinic.id,
                first_name=first_name,
                last_name=last_name,
                email=email,
                phone=phone,
                date_of_birth=dob,
                new_patient=new_patient,
            )
            session.add(patient)
            session.flush()
        patients.append(patient)
    return patients


def ensure_appointment_slots(
    session: Session,
    clinic: Clinic,
    providers: list[Provider],
) -> list[AppointmentSlot]:
    existing_slots = list(
        session.execute(
            select(AppointmentSlot)
            .where(AppointmentSlot.clinic_id == clinic.id)
            .order_by(AppointmentSlot.start_time)
        )
        .scalars()
        .all()
    )
    if len(existing_slots) >= 20:
        return existing_slots[:20]

    start_date = datetime.now(PHOENIX_TZ).date() + timedelta(days=1)
    day_offset = 0
    hours_by_count = {2: [9, 11], 3: [9, 11, 14]}

    while len(existing_slots) < 20 and day_offset < 14:
        current_date = start_date + timedelta(days=day_offset)
        day_offset += 1
        if current_date.weekday() == 6:
            continue

        provider = providers[(day_offset - 1) % len(providers)]
        daily_count = 3 if day_offset % 2 == 1 else 2

        for hour in hours_by_count[daily_count]:
            if len(existing_slots) >= 20:
                break

            start_time = datetime.combine(current_date, time(hour=hour), tzinfo=PHOENIX_TZ)
            existing_slot = first_or_none(
                session,
                select(AppointmentSlot).where(
                    AppointmentSlot.provider_id == provider.id,
                    AppointmentSlot.start_time == start_time,
                ),
            )
            if existing_slot:
                if existing_slot not in existing_slots:
                    existing_slots.append(existing_slot)
                continue

            slot = AppointmentSlot(
                clinic_id=clinic.id,
                provider_id=provider.id,
                start_time=start_time,
                end_time=start_time + timedelta(minutes=30),
                is_booked=False,
            )
            session.add(slot)
            session.flush()
            existing_slots.append(slot)

    return sorted(existing_slots, key=lambda item: item.start_time)[:20]


def ensure_appointments(
    session: Session,
    clinic: Clinic,
    patients: list[Patient],
    services: list[Service],
) -> list[Appointment]:
    existing_count = count_for_clinic(session, Appointment, clinic.id)
    existing_appointments = list(
        session.execute(
            select(Appointment)
            .where(Appointment.clinic_id == clinic.id)
            .order_by(Appointment.created_at)
        )
        .scalars()
        .all()
    )
    if existing_count >= 10:
        return existing_appointments[:10]

    available_slots = list(
        session.execute(
            select(AppointmentSlot)
            .where(
                AppointmentSlot.clinic_id == clinic.id,
                AppointmentSlot.is_booked.is_(False),
            )
            .order_by(AppointmentSlot.start_time)
        )
        .scalars()
        .all()
    )
    needed = 10 - existing_count
    if len(available_slots) < needed:
        raise RuntimeError("Not enough appointment slots available to seed appointments")

    created: list[Appointment] = []
    for index in range(needed):
        slot = available_slots[index]
        appointment_number = existing_count + index
        appointment = Appointment(
            clinic_id=clinic.id,
            patient_id=patients[appointment_number % len(patients)].id,
            provider_id=slot.provider_id,
            service_id=services[appointment_number % len(services)].id,
            slot_id=slot.id,
            status="rescheduled" if appointment_number in {2, 7} else "scheduled",
            reason=APPOINTMENT_REASONS[appointment_number],
            notes="Seeded demo appointment for Phase 1 walkthroughs.",
        )
        slot.is_booked = True
        session.add(appointment)
        created.append(appointment)
    session.flush()
    return existing_appointments + created


def ensure_conversations(
    session: Session,
    clinic: Clinic,
    patients: list[Patient],
) -> list[Conversation]:
    conversations = list(
        session.execute(
            select(Conversation)
            .where(Conversation.clinic_id == clinic.id)
            .order_by(Conversation.created_at)
        )
        .scalars()
        .all()
    )
    existing_count = len(conversations)

    if existing_count < 15:
        for index in range(existing_count, 15):
            channel, category, urgency, summary = CONVERSATION_DATA[index]
            conversation = Conversation(
                clinic_id=clinic.id,
                patient_id=patients[index % len(patients)].id,
                channel=channel,
                status="open" if urgency in {"high", "emergency"} else "closed",
                category=category,
                urgency=urgency,
                summary=summary,
            )
            session.add(conversation)
            conversations.append(conversation)
        session.flush()

    for index, conversation in enumerate(conversations[:15]):
        message_count = session.scalar(
            select(func.count()).select_from(Message).where(Message.conversation_id == conversation.id)
        )
        if message_count:
            continue
        session.add_all(
            [
                Message(
                    conversation_id=conversation.id,
                    sender="user",
                    content=CONVERSATION_DATA[index][3],
                ),
                Message(
                    conversation_id=conversation.id,
                    sender="assistant",
                    content="Thanks for reaching out. I can help gather details and route this to the right clinic workflow.",
                ),
            ]
        )
    session.flush()
    return conversations[:15]


def ensure_faqs(session: Session, clinic: Clinic) -> list[FAQ]:
    faqs: list[FAQ] = []
    for question, answer, category in FAQ_DATA:
        faq = first_or_none(
            session,
            select(FAQ).where(FAQ.clinic_id == clinic.id, FAQ.question == question),
        )
        if faq is None:
            faq = FAQ(
                clinic_id=clinic.id,
                question=question,
                answer=answer,
                category=category,
                active=True,
            )
            session.add(faq)
            session.flush()
        faqs.append(faq)
    return faqs


def ensure_intake_forms(
    session: Session,
    clinic: Clinic,
    patients: list[Patient],
    conversations: list[Conversation],
) -> list[IntakeForm]:
    existing_count = count_for_clinic(session, IntakeForm, clinic.id)
    existing_forms = list(
        session.execute(
            select(IntakeForm)
            .where(IntakeForm.clinic_id == clinic.id)
            .order_by(IntakeForm.created_at)
        )
        .scalars()
        .all()
    )
    if existing_count >= 5:
        return existing_forms[:5]

    reasons = [
        "Establish care and complete baseline health review",
        "Discuss recurring knee soreness after exercise",
        "Pediatric wellness visit and school form",
        "Review medication side effects",
        "Physical therapy evaluation for back stiffness",
    ]
    for index in range(existing_count, 5):
        form = IntakeForm(
            clinic_id=clinic.id,
            patient_id=patients[index % len(patients)].id,
            conversation_id=conversations[index % len(conversations)].id,
            reason_for_visit=reasons[index],
            insurance_provider=["Blue Cross", "Aetna", "Cigna", "UnitedHealthcare", "Medicare"][index],
            preferred_date=datetime.now(PHOENIX_TZ).date() + timedelta(days=index + 3),
            preferred_time=time(hour=[9, 10, 11, 13, 14][index]),
            symptoms=["none", "knee pain", "none", "dizziness", "back stiffness"][index],
            ai_summary=f"Intake captured for {reasons[index].lower()}.",
            missing_fields=[],
        )
        session.add(form)
        existing_forms.append(form)
    session.flush()
    return existing_forms[:5]


def ensure_escalations(
    session: Session,
    clinic: Clinic,
    conversations: list[Conversation],
) -> list[Escalation]:
    existing_count = count_for_clinic(session, Escalation, clinic.id)
    existing_escalations = list(
        session.execute(
            select(Escalation)
            .where(Escalation.clinic_id == clinic.id)
            .order_by(Escalation.created_at)
        )
        .scalars()
        .all()
    )
    if existing_count >= 3:
        return existing_escalations[:3]

    escalated_conversations = [
        conversation
        for conversation in conversations
        if conversation.urgency in {"high", "emergency"}
    ]
    reasons = [
        "High urgency symptom report needs staff review.",
        "Medication side effect report needs clinical follow-up.",
        "Emergency-level symptom report needs immediate triage workflow.",
    ]
    for index, conversation in enumerate(escalated_conversations[: 3 - existing_count]):
        escalation = Escalation(
            clinic_id=clinic.id,
            conversation_id=conversation.id,
            reason=reasons[existing_count + index],
            urgency=conversation.urgency,
            status="open",
        )
        session.add(escalation)
        existing_escalations.append(escalation)
    session.flush()
    return existing_escalations[:3]


def seed_database() -> None:
    session = SessionLocal()
    try:
        clinic = ensure_demo_clinic(session)
        providers = ensure_providers(session, clinic)
        services = ensure_services(session, clinic)
        ensure_demo_staff_user(session, clinic)
        patients = ensure_patients(session, clinic)
        ensure_appointment_slots(session, clinic, providers)
        appointments = ensure_appointments(session, clinic, patients, services)
        conversations = ensure_conversations(session, clinic, patients)
        faqs = ensure_faqs(session, clinic)
        intake_forms = ensure_intake_forms(session, clinic, patients, conversations)
        escalations = ensure_escalations(session, clinic, conversations)
        session.commit()
        print(
            "Seed complete: "
            f"clinic={clinic.name}, providers={len(providers)}, services={len(services)}, "
            f"patients={len(patients)}, appointments={len(appointments[:10])}, "
            f"conversations={len(conversations)}, faqs={len(faqs)}, "
            f"intake_forms={len(intake_forms)}, escalations={len(escalations)}"
        )
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    seed_database()
