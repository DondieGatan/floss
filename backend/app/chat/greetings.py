"""Recognizes a message that's *only* a greeting — "hi", "good morning" —
so the chat route can answer instantly with a canned welcome instead of
running it through retrieval and the low-confidence fallback, which would
otherwise tell a client "I don't have enough information" in response to
saying hello.

Deliberately only matches when the whole message is a greeting. "Hi, what
are your hours?" carries a real question and must NOT short-circuit here —
it falls through to normal retrieval, which handles the greeting-plus-
question case fine on its own.
"""
_GREETINGS = {
    "hi", "hello", "hey", "hi there", "hey there", "hiya", "yo", "howdy",
    "good morning", "good afternoon", "good evening", "greetings",
}

GREETING_RESPONSE = (
    "Hello! I'm the Floss Clinic assistant. I can help with appointments, "
    "hours, insurance, and general clinic questions — what would you like "
    "to know?"
)


def is_pure_greeting(query):
    normalized = query.strip().lower().rstrip("!.,? ")
    return normalized in _GREETINGS
