# Embedding model — small, CPU-friendly, 384-dim output.
EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"
EMBEDDING_DIM = 384

# Chunking — character-based windows over per-page text, not token-based.
# ~800-1000 chars comfortably fits under the model's 256-token context.
CHUNK_SIZE = 900
CHUNK_OVERLAP = 140

# Retrieval
TOP_K = 5
# Starting point, not a settled value — calibrated against the fixture-doc
# retrieval tests in tests/test_retrieval.py. Normalized MiniLM embeddings for
# genuinely related content typically score ~0.3-0.6+, unrelated content
# usually falls below ~0.2-0.3.
SIMILARITY_THRESHOLD = 0.35

# Uploads
ALLOWED_EXTENSIONS = {"pdf", "txt"}
