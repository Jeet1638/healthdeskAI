"""Booking-intent routing for the public chat assistant.

`_is_booking_related` decides whether a patient message is handled by the
deterministic booking flow or passed to the LLM. It used to substring-match a
keyword set that included "visit", so plain FAQs like "where do I park when I
visit?" were answered with appointment-slot text and never reached the LLM.

These cases need no database or LLM.
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.routes import ai as ai_routes


class FakeConversation:
    def __init__(self, category=None, status="open"):
        self.category = category
        self.status = status


class FakeMessage:
    def __init__(self, sender, content):
        self.sender = sender
        self.content = content


SLOT_ID = "a3f1c2d4-5b6e-4a7b-8c9d-0e1f2a3b4c5d"


@pytest.mark.parametrize(
    "message",
    [
        "Where do I park when I visit?",
        "What should I bring to my first visit?",
        "Do you accept Aetna insurance and what should I bring to my first visit?",
        "Do I need a referral for a consultation?",
        "How much does a checkup cost?",
        "Are lab results available online?",
        "Is the visit covered by my insurance?",
        "Can I bring my child to the visit?",
        "How long does a physical usually take?",
        "Do you offer telehealth visits?",
        "What are your office hours?",
        "Do you have a pediatrician on staff?",
    ],
)
def test_questions_mentioning_visits_are_not_booking_requests(message):
    assert ai_routes._is_booking_related(FakeConversation(), message, []) is False


@pytest.mark.parametrize(
    "message",
    [
        "I want to book an appointment",
        "Can I schedule a checkup?",
        "I need an appointment",
        "I'd like to make an appointment for next week",
        "Do you have any openings tomorrow?",
        "What are your next available appointment slots?",
        "What times are available on Monday?",
        "book me in please",
        "Can I get a follow-up visit this week?",
        "When is the earliest appointment?",
        "I need to reschedule my appointment",
        "show me slots",
        "Are there any slots free on Friday?",
        "Please set up a consultation",
        "When can I come in?",
        "What is your availability this week?",
    ],
)
def test_real_scheduling_requests_are_booking_requests(message):
    assert ai_routes._is_booking_related(FakeConversation(), message, []) is True


@pytest.mark.parametrize(
    "message",
    [
        "Jane Smith, jane@example.com, 555-123-4567, Follow-up Visit",
        "Follow-up Visit",
        "jane@example.com",
        "555-123-4567",
        SLOT_ID,
    ],
)
def test_mid_booking_replies_stay_in_the_booking_flow(message):
    """The flow asks for slot, name, email, phone and visit type; those answers
    carry no scheduling verb but must not fall through to the LLM."""
    conversation = FakeConversation(category="book_appointment")
    assert ai_routes._is_booking_related(conversation, message, []) is True


def test_vague_confirmation_after_slot_choice_stays_in_booking():
    conversation = FakeConversation(category="book_appointment")
    prior = [FakeMessage("user", SLOT_ID)]
    assert ai_routes._is_booking_related(conversation, "that one works", prior) is True


def test_booking_category_does_not_capture_later_faqs():
    """`_save_assistant_message` rewrites the category each turn, so once the
    thread moves to an FAQ the booking flow must let go."""
    conversation = FakeConversation(category="clinic_faq")
    message = "Where do I park when I visit?"
    assert ai_routes._is_booking_related(conversation, message, []) is False


def test_bare_name_in_a_fresh_conversation_is_not_booking():
    assert ai_routes._is_booking_related(FakeConversation(), "Jane Smith", []) is False


def test_slot_uuid_always_routes_to_booking():
    assert ai_routes._is_booking_related(FakeConversation(), SLOT_ID, []) is True
