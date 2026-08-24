# Embedding model — small, 384-dim output. Called remotely via the Hugging
# Face Inference API (see app/ml.py) rather than run in-process: torch +
# transformers' baseline memory footprint alone (~300-400MB just from
# import + one inference pass) doesn't fit alongside the rest of the app on
# Render's free-tier 512MB instances, confirmed via Render's own memory
# metrics — every embedding call pushed the process from ~100MB idle to
# ~400MB, getting it proactively recycled mid-request.
EMBEDDING_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
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
