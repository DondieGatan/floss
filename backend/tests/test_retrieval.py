"""Retrieval-quality tests against a fixed fixture doc with known, distinct
paragraphs (see tests/fixtures/sample.txt). These use the REAL embedding
API (not mocked) since they're exercising actual semantic retrieval
correctness — the one place in the suite where that real cost is worth
paying. Also serves as the empirical validation for SIMILARITY_THRESHOLD.

Requires HF_TOKEN (a real network call to Hugging Face's Inference API —
see app/ml.py) and skips cleanly without it, rather than failing CI runs
that don't have the secret configured.
"""
import os

import pytest

from app.extensions import db
from app.models import Document
from app.documents.ingestion import ingest_document
from app.chat.retrieval import retrieve, is_low_confidence
from app.ml import embed_query

pytestmark = [
    pytest.mark.real_embeddings,
    pytest.mark.skipif(not os.environ.get("HF_TOKEN"), reason="needs HF_TOKEN for real embedding calls"),
]

FIXTURE_PATH = os.path.join(os.path.dirname(__file__), "fixtures", "sample.txt")


@pytest.fixture()
def ingested_sample_doc(app, register_staff):
    headers, user_id = register_staff()

    with open(FIXTURE_PATH, "rb") as f:
        file_bytes = f.read()

    document = Document(uploaded_by=user_id, filename="sample.txt", status="pending")
    db.session.add(document)
    db.session.commit()

    ingest_document(document, file_bytes, "sample.txt")
    assert document.status == "ready", document.error_message

    return {"user_id": user_id, "document": document}


def test_on_topic_question_retrieves_correct_paragraph(ingested_sample_doc):
    document = ingested_sample_doc["document"]

    query_vector = embed_query("How do plants convert sunlight into energy?")
    results = retrieve(document.id, query_vector)

    assert results, "expected at least one retrieved chunk"
    top_chunk, top_score = results[0]
    assert "photosynthesis" in top_chunk.text.lower() or "chlorophyll" in top_chunk.text.lower()
    assert not is_low_confidence(results), (
        f"top score {top_score} unexpectedly fell below the confidence threshold "
        "for a clearly on-topic question"
    )


def test_another_on_topic_question_retrieves_correct_paragraph(ingested_sample_doc):
    document = ingested_sample_doc["document"]

    query_vector = embed_query("What caused the French Revolution?")
    results = retrieve(document.id, query_vector)

    assert results
    top_chunk, _score = results[0]
    assert "revolution" in top_chunk.text.lower() or "monarchy" in top_chunk.text.lower()
    assert not is_low_confidence(results)


def test_off_topic_question_is_flagged_low_confidence(ingested_sample_doc):
    document = ingested_sample_doc["document"]

    # Nothing in the fixture doc relates to this at all.
    query_vector = embed_query("What is the maximum takeoff weight of a Boeing 747?")
    results = retrieve(document.id, query_vector)

    assert is_low_confidence(results), (
        f"expected an unrelated question to fall below SIMILARITY_THRESHOLD, "
        f"got top score {results[0][1] if results else None} — recalibrate "
        "SIMILARITY_THRESHOLD in app/constants.py if this fails"
    )


def test_retrieval_is_not_owner_scoped(ingested_sample_doc, register_user):
    """A document uploaded by staff must be queryable by any authenticated
    user's chat — this is the core behavior change from Footnote's
    per-owner isolation to a shared hospital-wide knowledge base."""
    document = ingested_sample_doc["document"]
    patient_headers, _patient_id = register_user(email="someone-else@example.com")

    query_vector = embed_query("How do plants convert sunlight into energy?")
    results = retrieve(document.id, query_vector)

    assert results
    assert not is_low_confidence(results)


def test_no_documents_is_low_confidence(app):
    query_vector = embed_query("Anything at all.")
    results = retrieve(None, query_vector)
    assert results == []
    assert is_low_confidence(results)


def test_directory_digest_finds_a_specific_doctor_among_several(client, staff_headers, app):
    """Regression test: the directory digest used to render the whole
    directory as one blob and run it through the generic prose chunker,
    which packed several unrelated doctors into a single ~900-char chunk.
    Embedding that chunk diluted it enough that a query naming one specific
    dentist scored well under SIMILARITY_THRESHOLD even though their info
    was right there (confirmed manually: the same sentence scored 0.71
    alone vs. 0.16 packed into its original multi-doctor chunk). The fix
    chunks the digest one entity (department or doctor) at a time — this
    seeds enough doctors to have reproduced the dilution, then confirms the
    right one is still found with confidence."""
    dept_id = client.post(
        "/api/departments", headers=staff_headers, json={"name": "General Dentistry"}
    ).get_json()["department"]["id"]

    doctors = [
        ("Dr. Amara Osei", "General & Preventive Dentistry", "15 years helping patients keep healthy smiles."),
        ("Dr. Noah Bergstrom", "Family & Cosmetic Dentistry", "Believes a healthy smile starts with a comfortable visit."),
        ("Dr. Priya Nair", "Root Canal Therapy", "Focused on pain-free root canal treatment."),
        ("Dr. Thomas Okafor", "Microscopic Root Canal Therapy", "Uses precision tools to make root canals fast and comfortable."),
    ]
    for full_name, specialty, bio in doctors:
        client.post(
            "/api/doctors",
            headers=staff_headers,
            json={"fullName": full_name, "departmentId": dept_id, "specialty": specialty, "bio": bio},
        )

    query_vector = embed_query("Who is Dr. Amara Osei and what does she specialize in?")
    results = retrieve(None, query_vector)

    assert results
    top_chunk, top_score = results[0]
    assert "Amara Osei" in top_chunk.text
    assert not is_low_confidence(results), (
        f"top score {top_score} fell below the confidence threshold for a query "
        "naming a specific dentist who is in the digest — likely means chunks are "
        "packing multiple doctors together and diluting the embedding again"
    )
