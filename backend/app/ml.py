"""Embedding model access — a single lazily-loaded SentenceTransformer
instance shared by the whole process. Loading the model is the expensive
part (weight download/deserialization), not inference, so it must happen
once at first use, never per-request.
"""
import numpy as np

from app.constants import EMBEDDING_MODEL_NAME

_model = None


def _get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer(EMBEDDING_MODEL_NAME)
    return _model


def warm_embedding_model():
    """Force the lazy model load at worker boot instead of on a request.
    On Render's free-tier CPU the first real load can take longer than
    gunicorn's request timeout, turning a user's first chat message into a
    500 — call this once from create_app() so it happens before the worker
    starts accepting traffic."""
    _get_model()


def embed_texts(texts):
    """Embed a list of chunk texts. Returns an (N, EMBEDDING_DIM) float32 array,
    L2-normalized so cosine similarity reduces to a plain dot product."""
    if not texts:
        return np.empty((0,), dtype=np.float32)
    vectors = _get_model().encode(texts, normalize_embeddings=True, convert_to_numpy=True)
    return vectors.astype(np.float32)


def embed_query(text):
    """Embed a single query string. Returns a (EMBEDDING_DIM,) float32 vector."""
    vector = _get_model().encode([text], normalize_embeddings=True, convert_to_numpy=True)[0]
    return vector.astype(np.float32)
