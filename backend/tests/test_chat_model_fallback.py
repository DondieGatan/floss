"""The chat tries Gemini flash, then flash-lite, then Groq, so one exhausted
free quota (flash has a daily one) doesn't take the whole assistant down."""
import pytest

import app.chat.generation as generation
from app.agent.providers import reset_cooldowns
from app.chat.generation import stream_answer

PROMPT = {"system_instruction": "sys", "contents": "question"}


@pytest.fixture(autouse=True)
def _fresh_cooldowns():
    reset_cooldowns()
    yield
    reset_cooldowns()


@pytest.fixture()
def keys(app):
    app.config.update(GEMINI_API_KEY="g", GROQ_API_KEY="q", GROQ_MODEL="groq-model", GEMINI_FALLBACK_MODELS="gemini-2.5-flash-lite")


def _gemini_error(code, **extra):
    from google.genai import errors

    return errors.APIError(code, {"error": {"code": code, "message": "provider said no", **extra}})


class Recorder:
    """Stands in for _gemini_stream / _groq_stream: records who was asked and
    answers or fails per name."""

    def __init__(self, monkeypatch, behaviours):
        self.asked = []
        self.behaviours = behaviours

        def gemini(model, prompt):
            return self._run(f"gemini:{model}", prompt)

        def groq(prompt):
            return self._run("groq:groq-model", prompt)

        monkeypatch.setattr(generation, "_gemini_stream", gemini)
        monkeypatch.setattr(generation, "_groq_stream", groq)

    def _run(self, key, prompt):
        self.asked.append(key)
        behaviour = self.behaviours.get(key, ["fine from " + key])
        if isinstance(behaviour, Exception):
            raise behaviour
        yield from behaviour
        if False:  # pragma: no cover - makes this a generator even when it raises first
            yield ""


def _answer(prompt=PROMPT):
    return "".join(stream_answer(prompt))


def test_the_first_model_answers_when_it_is_fine(app, keys, monkeypatch):
    recorder = Recorder(monkeypatch, {"gemini:gemini-2.5-flash": ["Hello ", "there"]})
    with app.app_context():
        assert _answer() == "Hello there"
    assert recorder.asked == ["gemini:gemini-2.5-flash"]


def test_an_exhausted_daily_quota_falls_through_to_flash_lite_and_is_remembered(app, keys, monkeypatch, caplog):
    daily = _gemini_error(429, details=[{"retryDelay": "35000s"}])
    recorder = Recorder(monkeypatch, {"gemini:gemini-2.5-flash": daily})
    with app.app_context(), caplog.at_level("INFO"):
        assert _answer() == "fine from gemini:gemini-2.5-flash-lite"
        assert _answer() == "fine from gemini:gemini-2.5-flash-lite"
    # flash was tried once, then skipped for the second question instead of failing again
    assert recorder.asked == ["gemini:gemini-2.5-flash", "gemini:gemini-2.5-flash-lite", "gemini:gemini-2.5-flash-lite"]
    assert any("gemini:gemini-2.5-flash is busy" in r.getMessage() for r in caplog.records)
    assert any("Chat answered by gemini:gemini-2.5-flash-lite" in r.getMessage() for r in caplog.records)


def test_every_gemini_model_busy_falls_through_to_groq(app, keys, monkeypatch):
    busy = _gemini_error(429)
    recorder = Recorder(
        monkeypatch, {"gemini:gemini-2.5-flash": busy, "gemini:gemini-2.5-flash-lite": busy, "groq:groq-model": ["from groq"]}
    )
    with app.app_context():
        assert _answer() == "from groq"
    assert recorder.asked == ["gemini:gemini-2.5-flash", "gemini:gemini-2.5-flash-lite", "groq:groq-model"]


def test_a_broken_model_also_falls_through(app, keys, monkeypatch):
    Recorder(monkeypatch, {"gemini:gemini-2.5-flash": _gemini_error(400)})
    with app.app_context():
        assert _answer() == "fine from gemini:gemini-2.5-flash-lite"


def test_when_every_model_fails_the_last_error_is_raised(app, keys, monkeypatch):
    Recorder(
        monkeypatch,
        {
            "gemini:gemini-2.5-flash": _gemini_error(429),
            "gemini:gemini-2.5-flash-lite": _gemini_error(429),
            "groq:groq-model": RuntimeError("groq down"),
        },
    )
    with app.app_context(), pytest.raises(RuntimeError, match="groq down"):
        _answer()


def test_when_every_model_is_cooling_down_it_fails_fast_without_calling_anyone(app, keys, monkeypatch):
    err = _gemini_error(429)
    recorder = Recorder(
        monkeypatch,
        {"gemini:gemini-2.5-flash": err, "gemini:gemini-2.5-flash-lite": err, "groq:groq-model": RuntimeError("down")},
    )
    with app.app_context():
        with pytest.raises(RuntimeError):
            _answer()
        calls = len(recorder.asked)
        with pytest.raises(RuntimeError):
            _answer()
    assert len(recorder.asked) == calls


def test_a_failure_after_text_has_started_is_not_spliced_with_another_model(app, keys, monkeypatch):
    def half_then_die():
        yield "The clinic is open "
        raise _gemini_error(503)

    recorder = Recorder(monkeypatch, {})
    monkeypatch.setattr(generation, "_gemini_stream", lambda model, prompt: half_then_die())
    with app.app_context():
        received = []
        with pytest.raises(Exception) as caught:
            for token in stream_answer(PROMPT):
                received.append(token)
    assert received == ["The clinic is open "]
    assert "503" in str(caught.value)
    assert recorder.asked == []  # nobody else was asked to continue the sentence


def test_an_empty_first_model_answer_is_returned_not_retried(app, keys, monkeypatch):
    recorder = Recorder(monkeypatch, {"gemini:gemini-2.5-flash": []})
    with app.app_context():
        assert _answer() == ""
    assert recorder.asked == ["gemini:gemini-2.5-flash"]


def test_without_a_gemini_key_groq_alone_is_used(app, monkeypatch):
    app.config.update(GEMINI_API_KEY=None, GROQ_API_KEY="q", GROQ_MODEL="groq-model")
    recorder = Recorder(monkeypatch, {})
    with app.app_context():
        assert _answer() == "fine from groq:groq-model"
    assert recorder.asked == ["groq:groq-model"]


def test_with_no_key_at_all_it_says_so(app, monkeypatch):
    app.config.update(GEMINI_API_KEY=None, GROQ_API_KEY=None)
    with app.app_context(), pytest.raises(RuntimeError, match="No chat model is configured"):
        _answer()


def test_the_extra_gemini_models_can_be_turned_off(app, monkeypatch):
    app.config.update(GEMINI_API_KEY="g", GROQ_API_KEY=None, GEMINI_FALLBACK_MODELS="")
    recorder = Recorder(monkeypatch, {"gemini:gemini-2.5-flash": _gemini_error(429)})
    with app.app_context(), pytest.raises(Exception):
        _answer()
    assert recorder.asked == ["gemini:gemini-2.5-flash"]


def test_the_chat_route_streams_the_fallback_models_answer(client, auth_headers, app, monkeypatch):
    """End to end through the route: flash is out of quota, the patient still gets an answer."""
    from tests.test_chat import _parse_sse

    app.config.update(GEMINI_API_KEY="g", GROQ_API_KEY=None, GEMINI_FALLBACK_MODELS="gemini-2.5-flash-lite")
    Recorder(monkeypatch, {"gemini:gemini-2.5-flash": _gemini_error(429), "gemini:gemini-2.5-flash-lite": ["Open ", "9 to 5."]})
    conv = client.post("/api/chat/conversations", headers=auth_headers, json={}).get_json()["conversation"]["id"]
    resp = client.post(f"/api/chat/conversations/{conv}/messages", headers=auth_headers, json={"content": "What are your hours?"})

    events = _parse_sse(resp.data)
    assert not any(name == "error" for name, _ in events)
    assert next(data for name, data in events if name == "done")["content"] == "Open 9 to 5."
