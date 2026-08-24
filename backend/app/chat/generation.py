GROQ_MODEL = "openai/gpt-oss-20b"

SYSTEM_PROMPT = (
    "You are Floss Clinic, a dental clinic operational assistant. You help with appointments, "
    "dentist and department information, hours, insurance, and clinic policies.\n\n"
    "You may be given two kinds of information:\n"
    "1. Numbered source passages from the clinic's knowledge base. Cite every claim drawn from "
    "these inline with bracketed numbers like [1] or [2]. If they don't contain enough "
    "information to answer part of the question, say so plainly instead of guessing — do not "
    "use outside knowledge.\n"
    "2. An 'Account context' block, when present — live details about the specific patient "
    "you're talking to (their own appointments only, nobody else's). When this block is present, "
    "you DO have real-time access to this patient's own appointments — never claim you don't have "
    "access to their appointment details or tell them to check the website instead; answer from "
    "the block directly. It is a live account lookup, not a knowledge-base document, so use it "
    "with no bracketed citation number, and never invent an appointment detail that isn't in it. "
    "If a numbered source passage happens to be about appointment policy in general (e.g. how to "
    "book or cancel), that's a separate, citable fact — it is not a substitute for the Account "
    "context block when the question is about this patient's own appointments.\n\n"
    "You are NOT a dentist or medical professional and must never provide dental or "
    "medical advice, diagnose oral health issues or symptoms, or recommend treatment. "
    "If the user describes tooth pain, symptoms, or asks a diagnostic or treatment "
    "question, decline and direct them to book an appointment or contact a dentist "
    "instead — do not attempt to answer the medical advice question even if the "
    "source passages seem to contain relevant information."
)


def build_prompt(query, results, account_context=None):
    """results: [(Chunk, score), ...], already in citation order ([1]..[k]).
    account_context: build_account_context()'s return value, or None.
    Returns a Groq-shaped messages list."""
    context_lines = [
        f"[{i}] (p. {chunk.page_number}): {chunk.text}"
        for i, (chunk, _score) in enumerate(results, start=1)
    ]
    context = "\n\n".join(context_lines) if context_lines else "(no relevant knowledge-base passages found)"

    user_parts = [f"Source passages:\n\n{context}"]
    if account_context:
        user_parts.append(f"Account context (this patient only — not a citable source):\n\n{account_context}")
    user_parts.append(f"Question: {query}")

    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": "\n\n".join(user_parts)},
    ]


def _client():
    from flask import current_app
    from groq import Groq

    api_key = current_app.config["GROQ_API_KEY"]
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not configured.")
    return Groq(api_key=api_key)


def generate_answer(messages):
    """Non-streaming call — used for the first vertical slice, before SSE
    streaming is wired up. Returns the full answer text."""
    completion = _client().chat.completions.create(
        model=GROQ_MODEL,
        messages=messages,
        temperature=0.2,
    )
    return completion.choices[0].message.content


def stream_answer(messages):
    """Streaming generator — yields answer text incrementally. Wired into
    the chat route once SSE support is added."""
    stream = _client().chat.completions.create(
        model=GROQ_MODEL,
        messages=messages,
        temperature=0.2,
        stream=True,
    )
    for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta
