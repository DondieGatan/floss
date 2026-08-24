"""One-off maintenance script: re-embed every existing Chunk row through
the current embedding pipeline (app/ml.py). Needed once, right after
switching the embedding source (e.g. from a local model to a remote API,
or after changing EMBEDDING_MODEL_NAME) — existing rows were computed by
whatever the old pipeline was and won't be directly comparable to
freshly-embedded query vectors otherwise.

Safe to re-run — it always recomputes every chunk's embedding fresh, so
running it twice just does the same work again, not a mistake to avoid.

Usage: venv/Scripts/python.exe reembed_chunks.py
"""
from app import create_app
from app.extensions import db
from app.models import Chunk
from app.ml import embed_texts


def reembed_all():
    app = create_app()
    with app.app_context():
        chunks = Chunk.query.order_by(Chunk.id).all()
        if not chunks:
            print("No chunks to re-embed.")
            return

        print(f"Re-embedding {len(chunks)} chunks...")
        batch_size = 32
        for start in range(0, len(chunks), batch_size):
            batch = chunks[start:start + batch_size]
            vectors = embed_texts([c.text for c in batch])
            for chunk, vector in zip(batch, vectors):
                chunk.embedding = vector.tobytes()
            db.session.commit()
            print(f"  {min(start + batch_size, len(chunks))}/{len(chunks)}")

        print("Done.")


if __name__ == "__main__":
    reembed_all()
