import os
from datetime import timedelta


def _build_cors_origins():
    raw = os.environ.get("CORS_ORIGINS")
    if raw:
        return [origin.strip() for origin in raw.split(",") if origin.strip()]
    # Local Vite dev server only, by default — widen via CORS_ORIGINS once the
    # frontend is deployed somewhere else (e.g. Vercel).
    return ["http://localhost:5173"]


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "floss-dev-secret")
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "floss-jwt-dev-secret-please-change-in-prod")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=30)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)
    JWT_BLOCKLIST_ENABLED = True
    JWT_BLOCKLIST_TOKEN_CHECKS = ["access", "refresh"]

    CORS_ORIGINS = _build_cors_origins()

    # In-memory storage — fine for a single free-tier instance, resets on restart.
    RATELIMIT_ENABLED = True

    # GROQ_API_KEY is read lazily (os.environ.get, no validation here) so the
    # app can start, run migrations, and run the test suite without a real
    # key — it's only needed when a chat message actually reaches Groq.
    GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

    basedir = os.path.abspath(os.path.dirname(__file__))
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL", f"sqlite:///{os.path.join(basedir, 'footnote.db')}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    # A request that hits SQLITE_BUSY under real write contention (e.g. two
    # appointment bookings arriving at once) waits up to this long at the
    # driver level and retries, instead of erroring immediately. See
    # app/appointments/routes.py for what this is — and isn't — a guarantee
    # against; the actual defense against double-booking is the partial
    # unique index on Appointment in app/models.py.
    SQLALCHEMY_ENGINE_OPTIONS = {"connect_args": {"timeout": 10}}

    # Ingestion tuning — kept here (not constants.py) since MAX_UPLOAD_MB in
    # particular is the kind of thing worth overriding per-environment.
    MAX_UPLOAD_MB = int(os.environ.get("MAX_UPLOAD_MB", "20"))
    MAX_CONTENT_LENGTH = MAX_UPLOAD_MB * 1024 * 1024


class TestConfig(Config):
    TESTING = True
    RATELIMIT_ENABLED = False
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
