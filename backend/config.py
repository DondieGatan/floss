import os
from datetime import timedelta

from dotenv import load_dotenv

load_dotenv()


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

    # GEMINI_API_KEY is read lazily (os.environ.get, no validation here) so
    # the app can start, run migrations, and run the test suite without a
    # real key — it's only needed when a chat message actually reaches
    # Gemini. Uses Google AI Studio's free tier — no billing required.
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

    # Booking assistant (app/agent/): a tool-calling model that can propose
    # appointment changes for the patient to confirm. Same lazy pattern as
    # above — with none of these set the assistant's booking mode is simply
    # off (GET /api/agent/status says so) and the plain chat is unaffected.
    # AGENT_PROVIDER forces "azure" or "gemini"; left empty, Azure OpenAI is
    # used when all three AZURE_OPENAI_* values are set, else Gemini.
    AGENT_PROVIDER = os.environ.get("AGENT_PROVIDER", "")
    # Free tiers have rate limits, so set more than one: every configured
    # provider is tried in turn (azure, gemini, groq) and a rate-limited one
    # falls back to the next. GROQ_API_KEY is a free key from console.groq.com.
    GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
    GROQ_MODEL = os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b")
    AZURE_OPENAI_ENDPOINT = os.environ.get("AZURE_OPENAI_ENDPOINT")
    AZURE_OPENAI_API_KEY = os.environ.get("AZURE_OPENAI_API_KEY")
    AZURE_OPENAI_DEPLOYMENT = os.environ.get("AZURE_OPENAI_DEPLOYMENT")
    AZURE_OPENAI_API_VERSION = os.environ.get("AZURE_OPENAI_API_VERSION", "2024-10-21")

    # Same lazy-config pattern for outbound email (see app/email.py) — no
    # key means send_email() logs instead of sending, so password reset and
    # appointment reminders stay fully usable without a real account.
    # SendGrid is preferred over Resend when set — Resend's free tier can
    # only deliver to the email address the Resend account itself was
    # signed up with until a full domain is verified (confirmed directly:
    # sending to any other address 403s with "You can only send testing
    # emails to your own email address"). SendGrid's free tier only needs
    # one sender email verified (no domain/DNS) and then delivers to any
    # recipient.
    SENDGRID_API_KEY = os.environ.get("SENDGRID_API_KEY")
    SENDGRID_FROM = os.environ.get("SENDGRID_FROM", "")
    RESEND_API_KEY = os.environ.get("RESEND_API_KEY")
    EMAIL_FROM_ADDRESS = os.environ.get("EMAIL_FROM_ADDRESS", "Floss Clinic <onboarding@resend.dev>")
    # Used to build links inside outbound emails (e.g. the password-reset
    # link) — the backend has no other way to know where the frontend is
    # actually hosted.
    FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")

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
    # unique index on Appointment in app/models.py. `timeout` is a SQLite-only
    # DBAPI connect arg — psycopg2 rejects it outright, so it's only applied
    # when we're actually running on SQLite.
    #
    # On Postgres (Neon): pool_pre_ping tests a pooled connection before using
    # it, and pool_recycle retires old ones. Neon suspends an idle database
    # after a few minutes and a serverless function can sit frozen far longer
    # than that, so a connection held from the last request is often dead by
    # the next; without these the first request after a quiet spell fails.
    SQLALCHEMY_ENGINE_OPTIONS = (
        {"connect_args": {"timeout": 10}}
        if SQLALCHEMY_DATABASE_URI.startswith("sqlite")
        else {"pool_pre_ping": True, "pool_recycle": 300}
    )

    # Ingestion tuning — kept here (not constants.py) since MAX_UPLOAD_MB in
    # particular is the kind of thing worth overriding per-environment.
    # Vercel rejects a request body over 4.5 MB before the app sees it, so a
    # higher cap there would only turn into a confusing platform error.
    MAX_UPLOAD_MB = int(os.environ.get("MAX_UPLOAD_MB", "4" if os.environ.get("VERCEL") else "20"))
    MAX_CONTENT_LENGTH = MAX_UPLOAD_MB * 1024 * 1024

    # Shared secret for the platform's own scheduled jobs (see app/internal/).
    # Unset => those endpoints answer 404, i.e. switched off.
    CRON_SECRET = os.environ.get("CRON_SECRET")


class TestConfig(Config):
    TESTING = True
    RATELIMIT_ENABLED = False
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    # Tests must stay deterministic regardless of what's in a developer's
    # local .env — test_email.py in particular asserts on "no provider
    # configured" being the default, which a real local RESEND_API_KEY or
    # SENDGRID_API_KEY would otherwise silently violate.
    RESEND_API_KEY = None
    SENDGRID_API_KEY = None
    # Same reasoning for the model providers: a real local key must never
    # make a test hit (or silently enable) a live model.
    GEMINI_API_KEY = None
    GROQ_API_KEY = None
    CRON_SECRET = None
    AGENT_PROVIDER = ""
    AZURE_OPENAI_ENDPOINT = None
    AZURE_OPENAI_API_KEY = None
    AZURE_OPENAI_DEPLOYMENT = None
