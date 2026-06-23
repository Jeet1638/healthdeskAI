import asyncio
import sys
from pathlib import Path
from uuid import uuid4

from httpx import ASGITransport, AsyncClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.database import Base, SessionLocal, engine
from app.main import app
from app.models.all_models import Clinic, Escalation, FAQ
from app.routes import ai as ai_routes


Base.metadata.create_all(bind=engine)


def run_async(coro):
    return asyncio.run(coro)


async def make_client() -> AsyncClient:
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://testserver")


def create_clinic_with_faq() -> str:
    db = SessionLocal()
    try:
        clinic = Clinic(
            name=f"AI Test Clinic {uuid4().hex[:8]}",
            phone="602-555-0100",
            email="frontdesk@example.com",
            address="123 Wellness Ave, Phoenix, AZ 85004",
            timezone="America/Phoenix",
            opening_hours={
                "monday": "8am-5pm",
                "tuesday": "8am-5pm",
                "wednesday": "8am-5pm",
                "thursday": "8am-5pm",
                "friday": "8am-5pm",
                "saturday": "9am-1pm",
                "sunday": "closed",
            },
        )
        db.add(clinic)
        db.flush()
        db.add(
            FAQ(
                clinic_id=clinic.id,
                question="What are your hours?",
                answer="We are open Monday through Friday from 8am to 5pm.",
                category="hours",
                active=True,
            )
        )
        db.commit()
        return str(clinic.id)
    finally:
        db.close()


def test_chat_basic(monkeypatch):
    async def fake_chat(messages, clinic_context):
        assert messages
        assert clinic_context["faqs"]
        return {
            "intent": "clinic_faq",
            "response": "We are open Monday through Friday from 8am to 5pm.",
            "urgency": "low",
            "needs_human": False,
            "extracted_data": {},
        }

    async def scenario():
        clinic_id = create_clinic_with_faq()
        monkeypatch.setattr(ai_routes.ai_service, "chat", fake_chat)
        async with await make_client() as client:
            response = await client.post(
                "/api/v1/ai/chat",
                json={"message": "What are your hours?", "clinic_id": clinic_id},
            )
            body = response.json()

        assert response.status_code == 200
        assert body["conversation_id"]
        assert body["intent"] == "clinic_faq"
        assert body["urgency"] == "low"
        assert body["needs_human"] is False
        assert "Monday" in body["response"]

    run_async(scenario())


def test_chat_escalation():
    async def scenario():
        clinic_id = create_clinic_with_faq()
        async with await make_client() as client:
            response = await client.post(
                "/api/v1/ai/chat",
                json={"message": "I have chest pain", "clinic_id": clinic_id},
            )
            body = response.json()

        db = SessionLocal()
        try:
            escalation = (
                db.query(Escalation)
                .filter(Escalation.conversation_id == body["conversation_id"])
                .first()
            )
        finally:
            db.close()

        assert response.status_code == 200
        assert body["intent"] == "urgent_escalation"
        assert body["urgency"] == "emergency"
        assert body["needs_human"] is True
        assert "call 911" in body["response"]
        assert escalation is not None
        assert escalation.urgency == "emergency"

    run_async(scenario())


def test_summarize(monkeypatch):
    async def fake_chat(messages, clinic_context):
        return {
            "intent": "clinic_faq",
            "response": "We are open Monday through Friday from 8am to 5pm.",
            "urgency": "low",
            "needs_human": False,
            "extracted_data": {},
        }

    async def fake_summary(messages):
        assert len(messages) >= 2
        return "The patient asked about clinic hours. The assistant answered with weekday hours. No urgent issue was raised."

    async def scenario():
        clinic_id = create_clinic_with_faq()
        monkeypatch.setattr(ai_routes.ai_service, "chat", fake_chat)
        monkeypatch.setattr(ai_routes.ai_service, "summarize_conversation", fake_summary)
        async with await make_client() as client:
            chat_response = await client.post(
                "/api/v1/ai/chat",
                json={"message": "What are your hours?", "clinic_id": clinic_id},
            )
            conversation_id = chat_response.json()["conversation_id"]
            summary_response = await client.post(
                "/api/v1/ai/summarize",
                json={"conversation_id": conversation_id},
            )
            body = summary_response.json()

        assert chat_response.status_code == 200
        assert summary_response.status_code == 200
        assert body["summary"]
        assert "clinic hours" in body["summary"]

    run_async(scenario())


def test_classify_intent(monkeypatch):
    async def fake_classify(message: str) -> str:
        assert "book" in message.lower()
        return "book_appointment"

    async def scenario():
        monkeypatch.setattr(ai_routes.ai_service, "classify_intent", fake_classify)
        async with await make_client() as client:
            response = await client.post(
                "/api/v1/ai/classify-intent",
                json={"message": "I want to book appointment"},
            )
            body = response.json()

        assert response.status_code == 200
        assert body["intent"] == "book_appointment"

    run_async(scenario())
