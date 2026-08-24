"""Embedding access via the Hugging Face Inference API — no local model,
no torch/transformers/sentence-transformers dependency. See
app/constants.py:EMBEDDING_MODEL_NAME for why this is a remote call rather
than an in-process one.
"""
import os

import httpx
import numpy as np

from app.constants import EMBEDDING_MODEL_NAME

_API_URL = f"https://router.huggingface.co/hf-inference/models/{EMBEDDING_MODEL_NAME}/pipeline/feature-extraction"


def _call_api(inputs):
    token = os.environ.get("HF_TOKEN")
    if not token:
        raise RuntimeError("HF_TOKEN is not configured.")

    response = httpx.post(
        _API_URL,
        headers={"Authorization": f"Bearer {token}"},
        json={"inputs": inputs, "normalize": True},
        timeout=30,
    )
    response.raise_for_status()
    return response.json()


def embed_texts(texts):
    """Embed a list of chunk texts. Returns an (N, EMBEDDING_DIM) float32 array,
    L2-normalized so cosine similarity reduces to a plain dot product."""
    if not texts:
        return np.empty((0,), dtype=np.float32)
    vectors = _call_api(texts)
    return np.array(vectors, dtype=np.float32)


def embed_query(text):
    """Embed a single query string. Returns a (EMBEDDING_DIM,) float32 vector."""
    vectors = _call_api([text])
    return np.array(vectors[0], dtype=np.float32)
