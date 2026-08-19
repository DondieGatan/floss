"""Document ingestion: extract -> chunk -> embed -> persist.

Runs synchronously inside the upload request (see app/documents/routes.py for
why: at portfolio scale a background-job queue is unneeded complexity, and a
fire-and-forget thread risks silently dying if Render's free-tier worker
recycles mid-request).
"""
import re

from app.constants import CHUNK_SIZE, CHUNK_OVERLAP

_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+")
_WHITESPACE_RE = re.compile(r"\s+")


def extract_text(file_bytes, filename):
    """Returns (pages, total_page_count).

    pages is a list of (page_number, text) for pages that actually contain
    extractable text — 1-indexed. total_page_count is the document's real
    page count (may be larger than len(pages) if some pages had no text,
    e.g. a scanned image page — OCR fallback is a deliberate MVP omission).
    """
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext == "txt":
        text = file_bytes.decode("utf-8", errors="replace")
        pages = [(1, text)] if text.strip() else []
        return pages, 1

    if ext == "pdf":
        import fitz  # PyMuPDF

        pages = []
        with fitz.open(stream=file_bytes, filetype="pdf") as doc:
            total = doc.page_count
            for i, page in enumerate(doc):
                text = page.get_text()
                if text.strip():
                    pages.append((i + 1, text))
        return pages, total

    raise ValueError(f"Unsupported file type: {ext}")


def _split_sentences(text):
    text = _WHITESPACE_RE.sub(" ", text).strip()
    if not text:
        return []
    return [s.strip() for s in _SENTENCE_SPLIT_RE.split(text) if s.strip()]


def chunk_text(text, chunk_size=CHUNK_SIZE, overlap=CHUNK_OVERLAP):
    """Greedily packs sentences into ~chunk_size windows, carrying the
    trailing ~overlap chars of sentences into the next chunk for context
    continuity across chunk boundaries."""
    sentences = _split_sentences(text)
    if not sentences:
        return []

    chunks = []
    current = []
    current_len = 0

    for sentence in sentences:
        if current and current_len + len(sentence) + 1 > chunk_size:
            chunks.append(" ".join(current))
            overlap_sentences = []
            overlap_len = 0
            for s in reversed(current):
                if overlap_len + len(s) > overlap:
                    break
                overlap_sentences.insert(0, s)
                overlap_len += len(s) + 1
            current = overlap_sentences
            current_len = overlap_len
        current.append(sentence)
        current_len += len(sentence) + 1

    if current:
        chunks.append(" ".join(current))

    # Hard-split any pathologically long "sentence" (e.g. no punctuation at
    # all) that alone exceeds the chunk budget.
    final = []
    for chunk in chunks:
        if len(chunk) <= chunk_size * 1.5:
            final.append(chunk)
        else:
            start = 0
            while start < len(chunk):
                final.append(chunk[start:start + chunk_size])
                start += chunk_size - overlap
    return final


def chunk_pages(pages):
    """pages: list of (page_number, text). Returns a list of
    {page_number, chunk_index, text} dicts, chunk_index numbered
    sequentially across the whole document (citation-friendly ordering)."""
    result = []
    idx = 0
    for page_number, text in pages:
        for chunk in chunk_text(text):
            result.append({"page_number": page_number, "chunk_index": idx, "text": chunk})
            idx += 1
    return result


def ingest_document(document, file_bytes, filename):
    """Mutates `document` in place (status/error_message/page_count) and
    persists its Chunk rows. Commits at each terminal state so a failure
    partway through still leaves the Document in an honest `failed` state
    rather than stuck `processing`."""
    from app.extensions import db
    from app.models import Chunk
    from app.ml import embed_texts

    document.status = "processing"
    db.session.commit()

    try:
        pages, total_pages = extract_text(file_bytes, filename)
        chunk_dicts = chunk_pages(pages)

        if not chunk_dicts:
            document.status = "failed"
            document.error_message = "No extractable text found in this file."
            document.page_count = total_pages
            db.session.commit()
            return

        texts = [c["text"] for c in chunk_dicts]
        vectors = embed_texts(texts)

        for chunk_dict, vector in zip(chunk_dicts, vectors):
            db.session.add(Chunk(
                document_id=document.id,
                page_number=chunk_dict["page_number"],
                chunk_index=chunk_dict["chunk_index"],
                text=chunk_dict["text"],
                embedding=vector.tobytes(),
            ))

        document.status = "ready"
        document.page_count = total_pages
        db.session.commit()
    except Exception as exc:  # noqa: BLE001 - deliberately broad: any failure must land in `failed`, not crash the request
        db.session.rollback()
        document.status = "failed"
        document.error_message = f"Failed to process document: {exc}"[:500]
        db.session.commit()
