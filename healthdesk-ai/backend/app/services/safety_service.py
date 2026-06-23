ESCALATION_TRIGGERS = [
    "chest pain",
    "chest tightness",
    "difficulty breathing",
    "can't breathe",
    "shortness of breath",
    "severe bleeding",
    "uncontrolled bleeding",
    "suicidal",
    "self-harm",
    "want to die",
    "hurt myself",
    "stroke",
    "face drooping",
    "arm weakness",
    "fainting",
    "unconscious",
    "passed out",
    "severe allergic reaction",
    "anaphylaxis",
    "emergency",
    "call 911",
]

SAFE_ESCALATION_RESPONSE = """
I'm not able to provide medical advice or emergency support.
If this is a medical emergency, please call 911 or go to the nearest emergency room immediately.
I can create an urgent callback request for the clinic staff - would you like me to do that?
""".strip()


def check_escalation(message: str) -> bool:
    normalized_message = message.casefold()
    return any(trigger.casefold() in normalized_message for trigger in ESCALATION_TRIGGERS)
