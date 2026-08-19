import json


def _parse_sse(response_data):
    """Parses raw SSE text (as the Flask test client collects it from the
    generator) into a list of (event_name_or_None, data) tuples, in order."""
    text = response_data.decode() if isinstance(response_data, bytes) else response_data
    events = []
    event_name = None
    for line in text.split("\n"):
        if line.startswith("event: "):
            event_name = line[len("event: "):]
        elif line.startswith("data: "):
            events.append((event_name, json.loads(line[len("data: "):])))
            event_name = None
    return events


def test_create_conversation_without_document(client, auth_headers):
    resp = client.post("/api/chat/conversations", headers=auth_headers, json={})
    assert resp.status_code == 201
    assert resp.get_json()["conversation"]["documentId"] is None


def test_create_conversation_with_document_from_different_user_succeeds(client, register_user, uploaded_document):
    # The knowledge base is shared hospital-wide, not owner-scoped — any
    # authenticated user can start a conversation about any existing
    # document, regardless of who originally uploaded it.
    headers_b, _ = register_user(email="b@example.com")
    doc_id = uploaded_document["document"].id  # "uploaded_by" a different user

    resp = client.post("/api/chat/conversations", headers=headers_b, json={"documentId": doc_id})
    assert resp.status_code == 201
    assert resp.get_json()["conversation"]["documentId"] == doc_id


def test_create_conversation_with_missing_document_returns_404(client, auth_headers):
    resp = client.post("/api/chat/conversations", headers=auth_headers, json={"documentId": 999999})
    assert resp.status_code == 404


def test_post_message_requires_content(client, auth_headers):
    conv_id = client.post("/api/chat/conversations", headers=auth_headers, json={}).get_json()["conversation"]["id"]
    resp = client.post(f"/api/chat/conversations/{conv_id}/messages", headers=auth_headers, json={"content": ""})
    assert resp.status_code == 400


def test_post_message_cross_user_conversation_returns_404(client, register_user):
    headers_a, _ = register_user(email="a@example.com")
    headers_b, _ = register_user(email="b@example.com")
    conv_id = client.post("/api/chat/conversations", headers=headers_a, json={}).get_json()["conversation"]["id"]

    resp = client.post(f"/api/chat/conversations/{conv_id}/messages", headers=headers_b, json={"content": "hi"})
    assert resp.status_code == 404


def test_post_message_low_confidence_skips_groq_entirely(client, uploaded_document, mock_stream_answer):
    # uploaded_document's chunks carry fake, independently-random unit
    # vectors, so any real query embedding should score well below
    # SIMILARITY_THRESHOLD against them — this is deliberately NOT testing
    # retrieval quality (that's test_retrieval.py's job with the real
    # fixture doc), just that the low-confidence gate actually prevents a
    # Groq call and burns no quota.
    headers = uploaded_document["headers"]
    doc_id = uploaded_document["document"].id

    conv_id = client.post(
        "/api/chat/conversations", headers=headers, json={"documentId": doc_id}
    ).get_json()["conversation"]["id"]

    resp = client.post(
        f"/api/chat/conversations/{conv_id}/messages", headers=headers, json={"content": "Anything at all"}
    )
    assert resp.status_code == 200

    events = _parse_sse(resp.data)
    done_event = next(data for name, data in events if name == "done")
    assert done_event["citedChunkIds"] == []
    assert "don't have enough information" in done_event["content"].lower()
    mock_stream_answer.assert_not_called()


def test_post_message_high_confidence_calls_groq_and_persists_citations(
    client, uploaded_document, mock_stream_answer, monkeypatch
):
    import app.chat.routes as chat_routes

    headers = uploaded_document["headers"]
    doc_id = uploaded_document["document"].id
    chunks = uploaded_document["chunks"]

    # Force a high-confidence retrieval result deterministically, rather
    # than relying on real embedding similarity (that's test_retrieval.py's
    # job) — this test is about the chat orchestration/persistence path.
    fake_results = [(chunks[0], 0.91), (chunks[1], 0.55)]
    monkeypatch.setattr(chat_routes, "retrieve", lambda *a, **k: fake_results)

    conv_id = client.post(
        "/api/chat/conversations", headers=headers, json={"documentId": doc_id}
    ).get_json()["conversation"]["id"]

    resp = client.post(
        f"/api/chat/conversations/{conv_id}/messages", headers=headers, json={"content": "Tell me about it"}
    )
    assert resp.status_code == 200

    events = _parse_sse(resp.data)
    token_events = [data for name, data in events if name is None]
    done_event = next(data for name, data in events if name == "done")

    assert "".join(token_events) == "This is a canned answer [1]."
    assert done_event["content"] == "This is a canned answer [1]."
    assert done_event["citedChunkIds"] == [chunks[0].id, chunks[1].id]
    assert done_event["citations"] == [
        {"index": 1, "chunkId": chunks[0].id, "pageNumber": chunks[0].page_number, "excerpt": chunks[0].text},
        {"index": 2, "chunkId": chunks[1].id, "pageNumber": chunks[1].page_number, "excerpt": chunks[1].text},
    ]
    mock_stream_answer.assert_called_once()


def test_post_message_groq_failure_streams_error_without_persisting(
    client, uploaded_document, monkeypatch
):
    import app.chat.routes as chat_routes

    headers = uploaded_document["headers"]
    doc_id = uploaded_document["document"].id
    chunks = uploaded_document["chunks"]

    monkeypatch.setattr(chat_routes, "retrieve", lambda *a, **k: [(chunks[0], 0.91)])

    def _broken_stream(*a, **k):
        raise RuntimeError("boom")
        yield  # pragma: no cover - makes this a generator function

    monkeypatch.setattr(chat_routes, "stream_answer", _broken_stream)

    conv_id = client.post(
        "/api/chat/conversations", headers=headers, json={"documentId": doc_id}
    ).get_json()["conversation"]["id"]

    resp = client.post(
        f"/api/chat/conversations/{conv_id}/messages", headers=headers, json={"content": "Tell me about it"}
    )
    assert resp.status_code == 200  # SSE status is fixed at stream start; the failure is in-band

    events = _parse_sse(resp.data)
    assert any(name == "error" for name, _data in events)
    assert not any(name == "done" for name, _data in events)

    messages = client.get(f"/api/chat/conversations/{conv_id}/messages", headers=headers).get_json()["messages"]
    # Only the user's message should be persisted — no half-formed assistant reply.
    assert len(messages) == 1
    assert messages[0]["role"] == "user"


def test_list_messages_returns_conversation_history(client, uploaded_document, mock_stream_answer, monkeypatch):
    import app.chat.routes as chat_routes

    headers = uploaded_document["headers"]
    doc_id = uploaded_document["document"].id
    chunks = uploaded_document["chunks"]
    monkeypatch.setattr(chat_routes, "retrieve", lambda *a, **k: [(chunks[0], 0.91)])

    conv_id = client.post(
        "/api/chat/conversations", headers=headers, json={"documentId": doc_id}
    ).get_json()["conversation"]["id"]
    post_resp = client.post(
        f"/api/chat/conversations/{conv_id}/messages", headers=headers, json={"content": "Question one"}
    )
    post_resp.get_data()  # force the streaming generator to run to completion (and persist the reply)

    resp = client.get(f"/api/chat/conversations/{conv_id}/messages", headers=headers)
    messages = resp.get_json()["messages"]
    assert [m["role"] for m in messages] == ["user", "assistant"]
