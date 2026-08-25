"""Heuristic detector for prompt-injection attempts in user-controlled text
that reaches the chat prompt — the query itself, and free-text fields (like
an appointment's `reason`) that flow into account_context.

Deliberately NOT a blocklist that refuses the request: paraphrasing defeats
keyword matching trivially, and false positives on legitimate questions
("should I ignore mild soreness?") would just teach users to phrase things
differently without stopping anyone determined. Its only job is visibility
— log a suspected attempt so it isn't happening invisibly. The actual
defense is structural: see generation.py's delimiter tags and the system
prompt's explicit "data, not instructions" framing.
"""
import re

_INJECTION_PATTERNS = [
    re.compile(p, re.IGNORECASE)
    for p in (
        r"ignore (all |any )?(previous|prior|above|earlier) instructions",
        r"disregard (all |any )?(previous|prior|above|earlier)",
        r"new instructions\s*:",
        r"system prompt",
        r"you are now\b",
        r"act as (a|an)\b",
        r"pretend (you|to be)\b",
        r"jailbreak",
        r"</?(source_passages|account_context|question)\s*>",
    )
]


def looks_like_injection(text):
    """text: any single string being considered for the prompt (a chat
    query, or a value about to be folded into account_context). Returns
    True if it matches a known injection phrasing pattern."""
    if not text:
        return False
    return any(pattern.search(text) for pattern in _INJECTION_PATTERNS)


def log_if_suspicious(logger, user_id, source, text):
    """Best-effort visibility hook — logs and returns True if `text` looks
    like an injection attempt, otherwise does nothing and returns False.
    Never raises and never blocks the caller; source is a short label like
    "chat_query" or "appointment_reason" so log lines are greppable."""
    if not looks_like_injection(text):
        return False
    snippet = text[:200]
    logger.warning(
        "Suspected prompt-injection attempt (source=%s, user_id=%s): %r",
        source, user_id, snippet,
    )
    return True
