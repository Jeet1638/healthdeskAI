import asyncio
import sys
from pathlib import Path
from uuid import uuid4

from httpx import ASGITransport, AsyncClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.database import Base, engine
from app.main import app
from app.models import all_models as loaded_models


Base.metadata.create_all(bind=engine)
assert loaded_models


def run_async(coro):
    return asyncio.run(coro)


def unique_email() -> str:
    return f"phase2-{uuid4().hex}@example.com"


def registration_payload(email: str | None = None) -> dict[str, str]:
    suffix = uuid4().hex[:8]
    return {
        "name": f"Phase Two User {suffix}",
        "email": email or unique_email(),
        "password": "Demo1234!",
        "clinic_name": f"Phase Two Clinic {suffix}",
        "role": "admin",
    }


async def make_client() -> AsyncClient:
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://testserver")


async def register_user(client: AsyncClient, email: str | None = None):
    payload = registration_payload(email)
    response = await client.post("/api/v1/auth/register", json=payload)
    return response, payload


def test_register_success():
    async def scenario():
        async with await make_client() as client:
            response, payload = await register_user(client)
            body = response.json()

        assert response.status_code == 200
        assert body["access_token"]
        assert body["token_type"] == "bearer"
        assert body["user"]["email"] == payload["email"].lower()
        assert body["user"]["role"] == payload["role"]
        assert body["user"]["clinic_id"]
        assert "password_hash" not in body["user"]

    run_async(scenario())


def test_register_duplicate_email():
    async def scenario():
        async with await make_client() as client:
            email = unique_email()
            first_response, _ = await register_user(client, email)
            second_response, _ = await register_user(client, email)

        assert first_response.status_code == 200
        assert second_response.status_code == 400
        assert second_response.json()["detail"] == "Email is already registered"

    run_async(scenario())


def test_login_success():
    async def scenario():
        async with await make_client() as client:
            register_response, payload = await register_user(client)
            response = await client.post(
                "/api/v1/auth/login",
                json={"email": payload["email"], "password": payload["password"]},
            )
            body = response.json()

        assert register_response.status_code == 200
        assert response.status_code == 200
        assert body["access_token"]
        assert body["user"]["email"] == payload["email"].lower()

    run_async(scenario())


def test_login_wrong_password():
    async def scenario():
        async with await make_client() as client:
            register_response, payload = await register_user(client)
            response = await client.post(
                "/api/v1/auth/login",
                json={"email": payload["email"], "password": "WrongPassword123!"},
            )

        assert register_response.status_code == 200
        assert response.status_code == 401

    run_async(scenario())


def test_get_me_authenticated():
    async def scenario():
        async with await make_client() as client:
            register_response, payload = await register_user(client)
            token = register_response.json()["access_token"]
            response = await client.get(
                "/api/v1/auth/me",
                headers={"Authorization": f"Bearer {token}"},
            )
            body = response.json()

        assert response.status_code == 200
        assert body["email"] == payload["email"].lower()
        assert body["clinic"]["name"] == payload["clinic_name"]

    run_async(scenario())


def test_get_me_unauthenticated():
    async def scenario():
        async with await make_client() as client:
            response = await client.get("/api/v1/auth/me")

        assert response.status_code == 401

    run_async(scenario())


def test_update_clinic():
    async def scenario():
        async with await make_client() as client:
            register_response, _ = await register_user(client)
            token = register_response.json()["access_token"]
            update_payload = {
                "name": f"Updated Clinic {uuid4().hex[:8]}",
                "phone": "602-555-1212",
                "email": "updated.clinic@example.com",
                "address": "9876 N Central Ave, Phoenix, AZ 85020",
                "opening_hours": {
                    "monday": "7am-4pm",
                    "tuesday": "7am-4pm",
                    "wednesday": "7am-4pm",
                    "thursday": "7am-4pm",
                    "friday": "7am-3pm",
                    "saturday": "closed",
                    "sunday": "closed",
                },
            }
            response = await client.patch(
                "/api/v1/clinics/me",
                json=update_payload,
                headers={"Authorization": f"Bearer {token}"},
            )
            body = response.json()

        assert response.status_code == 200
        assert body["name"] == update_payload["name"]
        assert body["phone"] == update_payload["phone"]
        assert body["email"] == update_payload["email"]
        assert body["address"] == update_payload["address"]
        assert body["opening_hours"] == update_payload["opening_hours"]

    run_async(scenario())
