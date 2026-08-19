GROQ_MODEL = "llama-3.1-8b-instant"

SYSTEM_PROMPT = (
    "You are Floss, a dental clinic operational assistant. You help with appointments, "
    "dentist and department information, hours, insurance, and clinic policies — "
    "using ONLY the numbered source passages provided below. Cite the passages you "
    "used inline with bracketed numbers like [1] or [2]. If the provided passages do "
    "not contain enough information to answer the question, say so plainly instead of "
    "guessing — do not use outside knowledge.\n\n"
    "You are NOT a dentist or medical professional and must never provide dental or "
    "medical advice, diagnose oral health issues or symptoms, or recommend treatment. "
    "If the user describes tooth pain, symptoms, or asks a diagnostic or treatment "
    "question, decline and direct them to book an appointment or contact a dentist "
    "instead — do not attempt to answer the medical advice question even if the "
    "source passages seem to contain relevant information."
)


def build_prompt(query, results):
    """results: [(Chunk, score), ...], already in citation order ([1]..[k]).
    Returns a Groq-shaped messages list."""
    context_lines = [
        f"[{i}] (p. {chunk.page_number}): {chunk.text}"
        for i, (chunk, _score) in enumerate(results, start=1)
    ]
    context = "\n\n".join(context_lines)
    user_message = f"Source passages:\n\n{context}\n\nQuestion: {query}"
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_message},
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
