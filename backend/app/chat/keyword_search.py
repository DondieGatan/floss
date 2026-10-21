"""Keyword retrieval — the fallback when the embedding service is unavailable.

Semantic retrieval needs a query embedding from the Hugging Face Inference
API (see app/ml.py). If that call fails (no credits, outage, network), the
chat must not turn into a 500. This module scores chunks by weighted keyword
overlap instead: the share of the question's content words that appear in the
chunk, with rarer words (by inverse document frequency across the searched
chunks) counting for more. No external service, no model, deterministic.
"""
import math
import re

from app.constants import TOP_K

_WORD_RE = re.compile(r"[a-z0-9]+")

_STOPWORDS = frozenset(
    """a about after all also am an and any are as at be been but by can could did do does for from
    had has have he her his how i if in into is it its just may me my no not of on or our she should so
    some such than that the their them then there these they this to up us was we were what when where
    which who why will with would you your""".split()
)


def _stem(word):
    for suffix in ("ing", "ed", "es", "s"):
        if word.endswith(suffix) and len(word) - len(suffix) >= 3:
            return word[: -len(suffix)]
    return word


def tokenize(text):
    """Lower-cased, stopword-free, lightly stemmed word set."""
    return {_stem(w) for w in _WORD_RE.findall(text.lower()) if len(w) >= 3 and w not in _STOPWORDS}


def score_chunks(query, chunks):
    """Returns [(chunk, score)] for chunks matching at least one query word,
    best first. score is in [0, 1]: the idf-weighted fraction of the
    question's words found in the chunk."""
    query_terms = tokenize(query)
    if not query_terms or not chunks:
        return []

    chunk_terms = [tokenize(c.text) for c in chunks]
    n = len(chunks)
    idf = {}
    for term in query_terms:
        df = sum(1 for terms in chunk_terms if term in terms)
        idf[term] = 1 + math.log((n + 1) / (df + 1))  # smoothed: stays sensible with very few chunks
    total = sum(idf.values())
    if total <= 0:
        return []

    scored = []
    for chunk, terms in zip(chunks, chunk_terms):
        matched = sum(idf[t] for t in query_terms if t in terms)
        if matched > 0:
            scored.append((chunk, matched / total))
    scored.sort(key=lambda pair: -pair[1])
    return scored[:TOP_K]
