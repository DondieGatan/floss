from app.chat.generation import build_prompt, SYSTEM_PROMPT


def test_system_prompt_refuses_medical_advice():
    """The chatbot scope was explicitly limited to operational assistance
    (appointments, directory, hours, policies) — never diagnosis or
    treatment. This guards against that instruction silently regressing."""
    assert "medical advice" in SYSTEM_PROMPT.lower()
    assert "diagnos" in SYSTEM_PROMPT.lower()


def test_build_prompt_includes_system_prompt_and_citations():
    messages = build_prompt("What are the visiting hours?", [])
    assert messages[0] == {"role": "system", "content": SYSTEM_PROMPT}
    assert "What are the visiting hours?" in messages[1]["content"]
