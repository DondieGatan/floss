"""The chat must keep working when the embedding service (Hugging Face
Inference API) is unavailable: ingestion stores chunks without vectors, and
chat falls back to keyword retrieval instead of returning a 500."""
import numpy as np
import pytest

from app.chat.keyword_search import score_chunks, tokenize
from app.chat.retrieval import retrieve, retrieve_keyword, is_low_confidence
from app.constants import EMBEDDING_DIM, KEYWORD_MIN_SCORE
from app.documents.ingestion import ingest_document
from app.extensions import db
from app.models import Chunk, Document
from tests.test_chat import _parse_sse

CLINIC_TEXT = (
    "Our clinic opens at 8 AM and closes at 6 PM from Monday to Saturday. "
    "Emergency appointments are available on Sundays by phone only. "
    "Teeth whitening treatments take about one hour and need a prior consultation. "
    "We accept most major dental insurance plans and offer payment in instalments."
)


class _FakeChunk:
    def __init__(self, text):
        self.text = text


def _boom(*args, **kwargs):
    raise RuntimeError("402 Payment Required")


@pytest.fixture()
def embeddings_down(monkeypatch):
    import app.ml as ml
    import app.chat.routes as chat_routes

    monkeypatch.setattr(ml, "embed_texts", _boom)
    monkeypatch.setattr(ml, "embed_query", _boom)
    monkeypatch.setattr(chat_routes, "embed_query", _boom)


def test_tokenize_drops_stopwords_and_stems():
    assert tokenize("What are the opening hours?") == {"open", "hour"}


def test_score_chunks_ranks_the_matching_chunk_first():
    chunks = [_FakeChunk("We accept most dental insurance plans."), _FakeChunk("Teeth whitening takes one hour.")]
    ranked = score_chunks("Do you accept dental insurance?", chunks)
    assert ranked[0][0] is chunks[0]
    assert 0 < ranked[0][1] <= 1


def test_score_chunks_off_topic_question_scores_below_the_bar():
    chunks = [_FakeChunk("We accept most dental insurance plans.")]
    ranked = score_chunks("How do plants convert sunlight into energy?", chunks)
    assert not ranked or ranked[0][1] < KEYWORD_MIN_SCORE


def test_ingestion_without_embedding_service_still_stores_searchable_chunks(app, register_staff, embeddings_down):
    _headers, user_id = register_staff()
    document = Document(uploaded_by=user_id, filename="clinic.txt", status="pending")
    db.session.add(document)
    db.session.commit()

    ingest_document(document, CLINIC_TEXT.encode(), "clinic.txt")

    assert document.status == "ready"
    chunks = Chunk.query.filter_by(document_id=document.id).all()
    assert chunks and all(c.embedding == b"" for c in chunks)

    results = retrieve_keyword(document.id, "When does the clinic open on Monday?")
    assert results and "8 AM" in results[0][0].text
    assert not is_low_confidence(results, KEYWORD_MIN_SCORE)


def test_vector_search_ignores_chunks_that_have_no_embedding(app, register_staff):
    _headers, user_id = register_staff()
    document = Document(uploaded_by=user_id, filename="mixed.txt", status="ready", page_count=1)
    db.session.add(document)
    db.session.commit()
    db.session.add(Chunk(document_id=document.id, page_number=1, chunk_index=0, text="no vector", embedding=b""))
    db.session.commit()

    assert retrieve(document.id, np.ones(EMBEDDING_DIM, dtype=np.float32)) == []


def test_chat_answers_from_keywords_when_embedding_service_is_down(
    client, register_staff, mock_stream_answer, embeddings_down
):
    headers, user_id = register_staff()
    document = Document(uploaded_by=user_id, filename="clinic.txt", status="pending")
    db.session.add(document)
    db.session.commit()
    ingest_document(document, CLINIC_TEXT.encode(), "clinic.txt")

    conv_id = client.post(
        "/api/chat/conversations", headers=headers, json={"documentId": document.id}
    ).get_json()["conversation"]["id"]
    resp = client.post(
        f"/api/chat/conversations/{conv_id}/messages", headers=headers, json={"content": "What time does the clinic open?"}
    )

    assert resp.status_code == 200
    events = _parse_sse(resp.data)
    done = next(data for name, data in events if name == "done")
    assert done["citedChunkIds"], "keyword match should be cited"
    mock_stream_answer.assert_called_once()


def test_chat_off_topic_question_with_embedding_down_still_answers_without_citations(
    client, register_staff, mock_stream_answer, embeddings_down
):
    headers, user_id = register_staff()
    document = Document(uploaded_by=user_id, filename="clinic.txt", status="pending")
    db.session.add(document)
    db.session.commit()
    ingest_document(document, CLINIC_TEXT.encode(), "clinic.txt")

    conv_id = client.post(
        "/api/chat/conversations", headers=headers, json={"documentId": document.id}
    ).get_json()["conversation"]["id"]
    resp = client.post(
        f"/api/chat/conversations/{conv_id}/messages", headers=headers, json={"content": "Explain quantum computing basics"}
    )

    assert resp.status_code == 200
    done = next(data for name, data in _parse_sse(resp.data) if name == "done")
    assert done["citedChunkIds"] == []
