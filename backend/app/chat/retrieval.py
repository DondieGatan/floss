import numpy as np

from app.models import Chunk, Document
from app.constants import TOP_K, SIMILARITY_THRESHOLD, EMBEDDING_DIM
from app.chat.keyword_search import score_chunks


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

    # Chunks ingested while the embedding service was unavailable are stored
    # with an empty embedding (see app/ml.py:embed_texts_or_none); they are
    # reachable through retrieve_keyword() but invisible to vector search.
    chunks = [c for c in query.all() if len(c.embedding or b"") == EMBEDDING_DIM * 4]
    if not chunks:
        return []

    matrix = np.vstack([np.frombuffer(c.embedding, dtype=np.float32) for c in chunks])
    scores = matrix @ query_vector

    k = min(top_k, len(chunks))
    order = np.argsort(-scores)[:k]
    return [(chunks[i], float(scores[i])) for i in order]


def retrieve_keyword(document_id, query_text, top_k=TOP_K):
    """Fallback retrieval by keyword overlap, used when the query can't be
    embedded. Same shape as retrieve(): [(Chunk, score), ...], best first."""
    query = Chunk.query.join(Document, Chunk.document_id == Document.id).filter(
        Document.status == "ready",
    )
    if document_id is not None:
        query = query.filter(Chunk.document_id == document_id)
    return score_chunks(query_text, query.all())[:top_k]


def is_low_confidence(results, threshold=SIMILARITY_THRESHOLD):
    """True if there's nothing to search, or the best match isn't good
    enough to trust — keeps a probably-irrelevant chunk from being handed
    to the model as if it were an authoritative, citable numbered source.
    The model is still consulted either way (see app/chat/routes.py); this
    just controls whether it gets to cite anything."""
    if not results:
        return True
    top_score = results[0][1]
    return top_score < threshold
