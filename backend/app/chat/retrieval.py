import numpy as np

from app.models import Chunk, Document
from app.constants import TOP_K, SIMILARITY_THRESHOLD


def retrieve(document_id, query_vector, top_k=TOP_K):
    """Returns [(Chunk, score), ...] sorted by score descending, searched
    across the clinic's shared knowledge base (not owner-scoped — the
    knowledge base is staff-curated and readable by every authenticated
    user; only Conversation/Message history stays private per patient).
    document_id=None searches all ready documents.

    Brute-force cosine similarity via a single matrix-vector dot product —
    deliberately no external vector index. At portfolio scale (a handful of
    documents, low thousands of chunks) this is sub-millisecond to a few ms;
    the dominant retrieval latency is actually the query-embedding inference
    itself, not this search. See the build plan for when this would need to
    change (tens/hundreds of thousands of chunks -> pgvector/FAISS).
    """
    query = Chunk.query.join(Document, Chunk.document_id == Document.id).filter(
        Document.status == "ready",
    )
    if document_id is not None:
        query = query.filter(Chunk.document_id == document_id)

    chunks = query.all()
    if not chunks:
        return []

    matrix = np.vstack([np.frombuffer(c.embedding, dtype=np.float32) for c in chunks])
    scores = matrix @ query_vector

    k = min(top_k, len(chunks))
    order = np.argsort(-scores)[:k]
    return [(chunks[i], float(scores[i])) for i in order]


def is_low_confidence(results):
    """True if there's nothing to search, or the best match isn't good
    enough to trust — the actual grounding gate that keeps the model from
    answering off unrelated content, and saves a Groq call when it fires."""
    if not results:
        return True
    top_score = results[0][1]
    return top_score < SIMILARITY_THRESHOLD
