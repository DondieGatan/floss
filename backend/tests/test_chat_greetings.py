from app.chat.greetings import is_pure_greeting, GREETING_RESPONSE

from tests.test_chat import _parse_sse


def test_is_pure_greeting_matches_bare_greetings():
    assert is_pure_greeting("hi")
    assert is_pure_greeting("Hello!")
    assert is_pure_greeting("  good morning  ")
    assert is_pure_greeting("Hey there.")


def test_is_pure_greeting_does_not_match_greeting_plus_question():
    # A greeting attached to a real question must fall through to normal
    # retrieval, not short-circuit to the canned greeting-only reply.
    assert not is_pure_greeting("Hi, what are your hours?")
    assert not is_pure_greeting("Hello, do you take insurance?")


def test_is_pure_greeting_does_not_match_unrelated_text():
    assert not is_pure_greeting("What are your hours?")
    assert not is_pure_greeting("")


def test_post_message_greeting_gets_instant_canned_reply(client, auth_headers, mock_stream_answer):
    # A bare greeting should never reach the low-confidence fallback or
    # spend a Gemini call — it's answered directly.
    conv_id = client.post("/api/chat/conversations", headers=auth_headers, json={}).get_json()["conversation"]["id"]

    resp = client.post(f"/api/chat/conversations/{conv_id}/messages", headers=auth_headers, json={"content": "hi"})
    assert resp.status_code == 200

    events = _parse_sse(resp.data)
    done_event = next(data for name, data in events if name == "done")
    assert done_event["content"] == GREETING_RESPONSE
    assert done_event["citedChunkIds"] == []
    mock_stream_answer.assert_not_called()
