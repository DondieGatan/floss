import numpy as np
import pytest

from app import create_app
from app.extensions import db as _db
from app.constants import EMBEDDING_DIM
from config import TestConfig


@pytest.fixture()
def app():
    flask_app = create_app(TestConfig)
    with flask_app.app_context():
        _db.create_all()
        yield flask_app
        _db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def register_user(client):
    def _register(email="alex@example.com", password="password123", full_name="Alex Kim"):
        resp = client.post(
            "/api/auth/register",
            json={"fullName": full_name, "email": email, "password": password},
        )
        data = resp.get_json()
        headers = {"Authorization": f"Bearer {data['accessToken']}"}
        return headers, data["user"]["id"]

    return _register


@pytest.fixture()
def auth_headers(register_user):
    headers, _user_id = register_user()
    return headers


@pytest.fixture()
def register_staff(client):
    """Creates a staff/admin user directly via the ORM — public /register
    always creates role='patient' (deliberately: letting a self-service
    form pick its own role would be a privilege-escalation hole), so
    staff/admin accounts in tests are provisioned the same way they would
    be in production: out-of-band, not through the public endpoint."""
    def _register(email="staff@example.com", password="password123", full_name="Staff Member", role="staff"):
        from flask_jwt_extended import create_access_token
        from app.models import User

        user = User(full_name=full_name, email=email, role=role)
        user.set_password(password)
        _db.session.add(user)
        _db.session.commit()

        token = create_access_token(identity=str(user.id), additional_claims={"role": user.role})
        headers = {"Authorization": f"Bearer {token}"}
        return headers, user.id

    return _register


@pytest.fixture()
def staff_headers(register_staff):
    headers, _user_id = register_staff()
    return headers


@pytest.fixture()
def admin_headers(register_staff):
    headers, _user_id = register_staff(email="admin@example.com", role="admin")
    return headers


def _fake_vector(seed):
    """Deterministic pseudo-random unit vector, for tests that need a
    plausible-shaped embedding without loading the real model."""
    rng = np.random.default_rng(seed)
    vector = rng.normal(size=EMBEDDING_DIM).astype(np.float32)
    return vector / np.linalg.norm(vector)


@pytest.fixture()
def uploaded_document(app, register_user):
    """Creates a User + a ready Document with a couple of Chunk rows,
    bypassing real ingestion — for tests that only need *some* document to
    exist and don't care about real retrieval quality. The knowledge base
    is shared hospital-wide (not owner-scoped), so `uploaded_by` here is
    just attribution, not an access-control boundary — any authenticated
    user can read/query this document regardless of who "uploaded" it."""
    from app.models import Document, Chunk

    headers, user_id = register_user()

    document = Document(uploaded_by=user_id, filename="fixture.txt", status="ready", page_count=1)
    _db.session.add(document)
    _db.session.commit()

    chunks = []
    for i in range(3):
        chunk = Chunk(
            document_id=document.id,
            page_number=1,
            chunk_index=i,
            text=f"Fixture chunk {i} content.",
            embedding=_fake_vector(seed=i).tobytes(),
        )
        _db.session.add(chunk)
        chunks.append(chunk)
    _db.session.commit()

    return {"headers": headers, "user_id": user_id, "document": document, "chunks": chunks}


@pytest.fixture()
def mock_stream_answer(monkeypatch):
    """Replaces app.chat.generation.stream_answer with a canned,
    deterministic token generator and records whether it was called — so
    chat tests never hit the real Groq API, and the low-confidence fallback
    path can assert it was skipped entirely."""
    from unittest.mock import MagicMock
    import app.chat.routes as chat_routes

    def _fake_stream(*args, **kwargs):
        for token in ["This is ", "a canned ", "answer [1]."]:
            yield token

    mock = MagicMock(side_effect=_fake_stream)
    monkeypatch.setattr(chat_routes, "stream_answer", mock)
    return mock
