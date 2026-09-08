from __future__ import annotations

import json
from typing import Any

from openai import APIError, APITimeoutError, AsyncOpenAI, OpenAIError

from app.core.config import settings


SYSTEM_PROMPT = """
You are HealthDesk AI, an administrative front-desk assistant for a small clinic.
You help with: clinic FAQs, appointment booking, rescheduling, cancellations,
basic intake collection, clinic hours, services, providers, and policies.

You must NOT: diagnose medical conditions, recommend treatments, interpret symptoms
medically, provide emergency guidance beyond directing to emergency services.

When a user mentions urgent symptoms, emergency risk, self-harm, chest pain,
trouble breathing, severe bleeding, stroke symptoms, loss of consciousness,
or similar high-risk situations, your response MUST start with:
"ESCALATION:" followed by a safe message directing them to emergency services.

Always return your response as valid JSON only:
{
  "intent": "book_appointment|reschedule_appointment|cancel_appointment|clinic_faq|insurance_question|new_patient_intake|urgent_escalation|general_question|unknown",
  "response": "...",
  "urgency": "low|medium|high|emergency",
  "needs_human": true|false,
  "extracted_data": {}
}
Do not include any text outside the JSON.
Use clinic_faq for questions about hours, location, parking, accepted insurance, policies, providers, services, referrals, lab results, or what to bring.
Use book_appointment when the patient asks to schedule, book, or find an available visit.
Use reschedule_appointment or cancel_appointment when the patient asks to change or cancel an existing visit.
Use new_patient_intake when collecting a new patient's reason for visit, insurance, preferences, or symptoms.
""".strip()

INTENTS = {
    "book_appointment",
    "reschedule_appointment",
    "cancel_appointment",
    "clinic_faq",
    "insurance_question",
    "new_patient_intake",
    "urgent_escalation",
    "general_question",
    "unknown",
}

URGENCY_VALUES = {"low", "medium", "high", "emergency"}
SUPPORTED_LLM_PROVIDERS = {"openai", "groq"}
DEFAULT_MODELS = {
    "openai": "gpt-4o-mini",
    "groq": "openai/gpt-oss-20b",
}


class AIServiceError(RuntimeError):
    pass


def _llm_provider() -> str:
    provider = settings.LLM_PROVIDER.strip().lower() or "openai"
    if provider not in SUPPORTED_LLM_PROVIDERS:
        raise AIServiceError(
            f"LLM_PROVIDER must be one of: {', '.join(sorted(SUPPORTED_LLM_PROVIDERS))}"
        )
    return provider


def _llm_model() -> str:
    provider = _llm_provider()
    return settings.LLM_MODEL.strip() or DEFAULT_MODELS[provider]


def _client() -> AsyncOpenAI:
    placeholder_values = {
        "replace_with_openai_key",
        "replace_with_openai_api_key",
        "replace_with_groq_key",
        "replace_with_groq_api_key",
        "your_openai_api_key",
        "your_groq_api_key",
        "your_key",
    }

    provider = _llm_provider()
    if provider == "groq":
        api_key = settings.GROQ_API_KEY.strip()
        key_name = "GROQ_API_KEY"
        base_url = "https://api.groq.com/openai/v1"
    else:
        api_key = settings.OPENAI_API_KEY.strip()
        key_name = "OPENAI_API_KEY"
        base_url = None

    if (
        not api_key
        or api_key.lower() in placeholder_values
        or api_key.lower().startswith("replace_with_")
    ):
        raise AIServiceError(f"{key_name} is not configured")

    if base_url is not None:
        return AsyncOpenAI(api_key=api_key, base_url=base_url)
    return AsyncOpenAI(api_key=api_key)


def _json_default(value: Any) -> str:
    return str(value)


def _llm_error_message(action: str, exc: Exception) -> str:
    provider = _llm_provider().title()
    status_code = getattr(exc, "status_code", None)
    if status_code == 429:
        return (
            f"{provider} {action} failed because this API key has no available quota "
            "or is being rate limited. Check provider billing, usage limits, and project credits."
        )
    if status_code in {401, 403}:
        return (
            f"{provider} {action} failed because the API key is invalid or not allowed "
            "to use this model."
        )
    if status_code == 404:
        return (
            f"{provider} {action} failed because the model '{_llm_model()}' does not exist "
            "or is not available to this key. The provider may have decommissioned it. "
            "Set LLM_MODEL to a currently supported model."
        )
    if isinstance(exc, APITimeoutError):
        return f"{provider} {action} timed out. Please try again."
    provider_detail = str(exc).strip()
    if provider_detail:
        return f"{provider} {action} failed: {provider_detail}"
    return f"{provider} {action} failed"


def _content_from_choice(completion: Any) -> str:
    try:
        content = completion.choices[0].message.content
    except (AttributeError, IndexError) as exc:
        raise AIServiceError("OpenAI response did not include a message") from exc
    if not content:
        raise AIServiceError("OpenAI response content was empty")
    return content.strip()


def _parse_json_response(content: str) -> dict[str, Any]:
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as exc:
        raise AIServiceError("OpenAI returned invalid JSON") from exc
    if not isinstance(parsed, dict):
        raise AIServiceError("OpenAI JSON response must be an object")
    return parsed


def _normalize_chat_payload(payload: dict[str, Any]) -> dict[str, Any]:
    intent = str(payload.get("intent") or "unknown")
    urgency = str(payload.get("urgency") or "low")
    extracted_data = payload.get("extracted_data")

    if intent not in INTENTS:
        intent = "unknown"
    if urgency not in URGENCY_VALUES:
        urgency = "low"
    if not isinstance(extracted_data, dict):
        extracted_data = {}

    return {
        "intent": intent,
        "response": str(payload.get("response") or "").strip(),
        "urgency": urgency,
        "needs_human": bool(payload.get("needs_human", False)),
        "extracted_data": extracted_data,
    }


def _message_to_openai(message: Any) -> dict[str, str]:
    if isinstance(message, dict):
        sender = str(message.get("sender") or message.get("role") or "user")
        content = str(message.get("content") or "")
    else:
        sender = str(getattr(message, "sender", "user"))
        content = str(getattr(message, "content", ""))

    role = "assistant" if sender == "assistant" else "user"
    if sender in {"staff", "system"}:
        role = "user"
        content = f"{sender}: {content}"
    return {"role": role, "content": content}


async def chat(messages: list, clinic_context: dict) -> dict:
    context_message = (
        "Clinic context for this conversation:\n"
        f"{json.dumps(clinic_context, default=_json_default, ensure_ascii=False)}"
    )
    openai_messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "system", "content": context_message},
        *[_message_to_openai(message) for message in messages],
    ]

    try:
        completion = await _client().chat.completions.create(
            model=_llm_model(),
            messages=openai_messages,
            temperature=0.2,
            response_format={"type": "json_object"},
        )
    except (APITimeoutError, APIError, OpenAIError) as exc:
        raise AIServiceError(_llm_error_message("chat request", exc)) from exc

    payload = _parse_json_response(_content_from_choice(completion))
    normalized = _normalize_chat_payload(payload)
    if not normalized["response"]:
        raise AIServiceError("OpenAI chat response was missing response text")
    return normalized


async def classify_intent(message: str) -> str:
    prompt = (
        "Classify this clinic front-desk message into exactly one intent. "
        "Return JSON only as {\"intent\":\"...\"}. Valid intents are: "
        + ", ".join(sorted(INTENTS))
        + f"\n\nMessage: {message}"
    )
    try:
        completion = await _client().chat.completions.create(
            model=_llm_model(),
            messages=[
                {
                    "role": "system",
                    "content": "You classify clinic administrative messages. Return valid JSON only.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0,
            response_format={"type": "json_object"},
        )
    except (APITimeoutError, APIError, OpenAIError) as exc:
        raise AIServiceError(_llm_error_message("intent classification", exc)) from exc

    payload = _parse_json_response(_content_from_choice(completion))
    intent = str(payload.get("intent") or "unknown")
    return intent if intent in INTENTS else "unknown"


async def summarize_conversation(messages: list) -> str:
    transcript = "\n".join(
        f"{getattr(message, 'sender', message.get('sender', 'user') if isinstance(message, dict) else 'user')}: "
        f"{getattr(message, 'content', message.get('content', '') if isinstance(message, dict) else '')}"
        for message in messages
    )
    try:
        completion = await _client().chat.completions.create(
            model=_llm_model(),
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Create a concise 3-5 sentence staff summary of a clinic front-desk "
                        "conversation. Include patient request, missing details, urgency, and next action. "
                        "Use only facts explicitly present in the transcript. Do not invent providers, "
                        "conditions, appointments, dates, or patient details. If a detail is not present, "
                        "say it was not provided. Return plain text only with no heading, markdown, "
                        "bullets, or preamble."
                    ),
                },
                {"role": "user", "content": f"Summarize only this transcript:\n<transcript>\n{transcript}\n</transcript>"},
            ],
            temperature=0.2,
        )
    except (APITimeoutError, APIError, OpenAIError) as exc:
        raise AIServiceError(_llm_error_message("conversation summary", exc)) from exc

    summary = _content_from_choice(completion)
    if not summary:
        raise AIServiceError("OpenAI summary was empty")
    return summary


async def extract_intake(messages: list) -> dict:
    transcript = "\n".join(
        f"{getattr(message, 'sender', message.get('sender', 'user') if isinstance(message, dict) else 'user')}: "
        f"{getattr(message, 'content', message.get('content', '') if isinstance(message, dict) else '')}"
        for message in messages
    )
    try:
        completion = await _client().chat.completions.create(
            model=_llm_model(),
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Extract structured clinic intake data from the transcript. Return valid JSON only "
                        "with keys reason_for_visit, insurance_provider, preferred_date, preferred_time, symptoms. "
                        "Use null when a field is not found. preferred_date should be ISO YYYY-MM-DD when possible; "
                        "preferred_time should be HH:MM when possible."
                    ),
                },
                {"role": "user", "content": transcript},
            ],
            temperature=0,
            response_format={"type": "json_object"},
        )
    except (APITimeoutError, APIError, OpenAIError) as exc:
        raise AIServiceError(_llm_error_message("intake extraction", exc)) from exc

    payload = _parse_json_response(_content_from_choice(completion))
    return {
        "reason_for_visit": payload.get("reason_for_visit"),
        "insurance_provider": payload.get("insurance_provider"),
        "preferred_date": payload.get("preferred_date"),
        "preferred_time": payload.get("preferred_time"),
        "symptoms": payload.get("symptoms"),
    }
