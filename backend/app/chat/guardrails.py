"""Code-enforced guardrails for the clinic assistants (chat and booking).

The system prompt tells the model what it may and may not discuss, but a
prompt is a request, not a lock. These checks don't depend on the model
cooperating:

  * screen_question()  — runs BEFORE the model. Clear attempts to probe the
    system's security, extract the assistant's instructions, or reach other
    people's data get a fixed reply and the model is never called.
  * OutputGuard        — runs on the model's reply as it streams. If the reply
    contains something that must never leave the server (an API key, a token,
    a database URL, the prompt's secret marker), it is cut off before it
    reaches the screen and replaced.

Both are deliberately narrow. A false positive blocks a real patient, so the
patterns target unambiguous phrasings ("what is your api key", "ignore your
previous instructions"), not broad words; "how do I reset my password" and
"what can staff do" must keep working. The prompt's own rules, the data-fencing
in generation.py and the log-only injection_guard remain the other layers.
"""
import re
from typing import NamedTuple, Optional

# Appears only inside the system prompt (generation.py). It carries no meaning;
# if it ever shows up in an answer, the prompt is being echoed.
CANARY = "floss-canary-4d1c7a9e"

SECURITY_REPLY = (
    "I can't help with how Floss Clinic's security works, or with getting into accounts, keys or data "
    "that aren't yours. I'm happy to explain how to use the app, or help with appointments, the clinic "
    "and general dental questions. If you have a security concern, please tell the clinic's admin or front desk."
)
PROMPT_REPLY = (
    "I can't share or change my instructions, but I'm happy to help with appointments, the clinic, "
    "how to use Floss Clinic, or general dental questions."
)
OTHERS_REPLY = (
    "I can only talk about your own appointments and account, not other people's. "
    "Is there something about your own care or the clinic I can help with?"
)
OUTPUT_BLOCKED_REPLY = (
    "Sorry, I can't share that. I'm happy to help with appointments, the clinic, how to use "
    "Floss Clinic, or general dental questions."
)
TOO_LONG_TEMPLATE = "Please keep messages under {limit} characters."

MAX_QUESTION_CHARS = 1000


class Screened(NamedTuple):
    category: str  # "security" | "prompt_extraction" | "other_people"
    reply: str


def _compile(patterns):
    return [re.compile(p, re.IGNORECASE) for p in patterns]


# Asking the assistant to reveal or override its instructions.
_PROMPT_EXTRACTION = _compile((
    r"\b(reveal|show|print|repeat|output|display|leak|dump|recite|give|tell)\b.{0,25}\b(your|the)\b.{0,15}"
    r"\b(system|hidden|initial|original|secret|internal)?\s*(prompt|instructions|rules|guidelines|guide)\b",
    r"\bwhat\b.{0,15}\b(is|are|were)\b.{0,15}\byour\b.{0,15}\b(system )?(prompt|instructions|rules)\b",
    r"\b(ignore|disregard|forget|override)\b.{0,20}\b(all |any |your |the )?(previous|prior|above|earlier|system|original)\b"
    r".{0,20}\b(instructions?|rules|prompt|guidelines|restrictions)\b",
    r"\b(jailbreak|do anything now|developer mode)\b",
    r"\bsystem prompt\b",
))

# Probing how the system is secured, or asking for secrets/ways around it.
_SECURITY = _compile((
    r"\b(api|secret|private|access|auth|bearer|signing|encryption)[ _-]?(key|token)s?\b",
    r"\bjwt\b|json web token",
    r"\b(hash|hashed|hashing|salted|bcrypt|argon)\w*\b.{0,30}\bpasswords?\b|\bpasswords?\b.{0,30}\b(hash|hashed|hashing|stored|storage|encrypted)\b",
    r"\b(vulnerabilit|exploit|pen[- ]?test|penetration test|backdoor|sql ?injection|xss\b|csrf\b|cross[- ]site|"
    r"privilege escalation|brute[- ]?forc|remote code execution|\brce\b)",
    r"\b(hack|hacking|hacked)\b",
    r"\bbypass(ing)?\b.{0,40}\b(login|log in|sign[- ]?in|2fa|two[- ]factor|auth\w*|rate.?limit\w*|permission\w*|role\w*|restriction\w*|verification)\b",
    r"\bhow\b.{0,12}\b(is|are|does|do)\b.{0,50}\b(secure|secured|security|protected|encrypted|authenticat\w+|authoriz\w+)\b",
    r"\b(environment variables?|\.env\b|config(uration)? (file|secrets?)|connection string)\b",
    r"\bdatabase\b.{0,20}\b(password|credentials?|url|host|schema|dump|connection)\b",
    r"\b(admin|owner|staff|root|default)\b.{0,12}\b(password|credentials?|login)\b",
    r"\b(2fa|totp|two[- ]factor)\b.{0,20}\b(secret|seed|backup codes?|bypass|disable for)\b",
    r"\brate.?limit(s|ing)?\b",
    r"\b(security|authentication) (flaw|hole|weakness|bug|issue)s?\b",
))

# Asking for other patients' or users' information.
#
# Needs an actual request verb ("show me all patients' appointments"), so a
# how-the-system-works question like "can staff see all patients'
# appointments?" is NOT caught; the prompt and the account-scoped lookups
# are what keep the assistant from ever having other people's data.
_OTHER_PEOPLE = _compile((
    r"\b(show|list|give|tell|get|send|export|reveal|read)\b.{0,20}\b(other|another|all|every|everyone'?s?|someone else'?s?|anyone'?s?)\b"
    r".{0,12}\b(patients?|users?|people|customers?|accounts?)['’]?s?\b"
    r".{0,20}\b(data|appointments?|records?|emails?|phone|details|information|schedule|history|passwords?)\b",
    r"\b(list|show|give|export)\b.{0,15}\b(me )?(all|every)\b.{0,12}\b(users?|patients?|emails?|accounts?|phone numbers?)\b",
))


def screen_question(text) -> Optional[Screened]:
    """Returns a Screened(category, canned reply) for a message that must not
    reach the model, else None. Order matters: instruction-extraction first
    (it often mentions security words too)."""
    if not text:
        return None
    if any(p.search(text) for p in _PROMPT_EXTRACTION):
        return Screened("prompt_extraction", PROMPT_REPLY)
    if any(p.search(text) for p in _SECURITY):
        return Screened("security", SECURITY_REPLY)
    if any(p.search(text) for p in _OTHER_PEOPLE):
        return Screened("other_people", OTHERS_REPLY)
    return None


# --- output -----------------------------------------------------------------

_LEAK_PATTERNS = _compile((
    re.escape(CANARY),
    r"AIza[0-9A-Za-z_\-]{20,}",  # Google API key
    r"\bgsk_[A-Za-z0-9]{20,}",  # Groq
    r"\bhf_[A-Za-z0-9]{20,}",  # Hugging Face
    r"\bSG\.[A-Za-z0-9_\-]{16,}",  # SendGrid
    r"\bre_[A-Za-z0-9_]{20,}",  # Resend
    r"\bsk-[A-Za-z0-9_\-]{20,}",  # OpenAI-style
    r"\beyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.",  # a JWT
    r"postgres(?:ql)?(?:\+\w+)?://\S+",  # database URL
    r"-----BEGIN [A-Z ]*PRIVATE KEY-----",
    r"you are floss assistant",  # the prompt's opening words (a reply says "I'm Floss Assistant", never "You are")
    r"system guide \(trusted reference",  # the guide's heading
    r"</?(source_passages|account_context|question|user_role)\s*>",
))


def leaks_secret(text) -> bool:
    return any(p.search(text) for p in _LEAK_PATTERNS)


class OutputGuard:
    """Feed model tokens in; get back only text that is safe to show.

    Holds back the last HOLD characters so a secret split across two tokens is
    still caught before any of it is released. HOLD must be at least as long
    as the shortest text that completes any leak pattern (the guardrail tests
    check this), otherwise the front of a leak could be shown before the
    pattern finishes matching. Once something is blocked, `blocked` is True and
    nothing more is released; the caller swaps in OUTPUT_BLOCKED_REPLY as the
    final message."""

    HOLD = 48

    def __init__(self):
        self._text = ""
        self._released = 0
        self.blocked = False

    def feed(self, token):
        if self.blocked:
            return ""
        self._text += token
        if leaks_secret(self._text):
            self.blocked = True
            return ""
        upto = max(self._released, len(self._text) - self.HOLD)
        out = self._text[self._released:upto]
        self._released = upto
        return out

    def flush(self):
        if self.blocked:
            return ""
        out = self._text[self._released:]
        self._released = len(self._text)
        return out
