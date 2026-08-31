from app import create_app
from app.extensions import db as _db
from config import TestConfig


def test_health_returns_ok(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.get_json() == {"status": "ok"}


def test_health_is_exempt_from_the_rate_limit_that_blocks_other_routes():
    """Render's own health-check pinger hits this route far more often than
    any real traffic would (every few seconds, indefinitely) — if it shared
    the app's default rate limit ("300 per hour", see app/extensions.py)
    with everything else, that pinger alone would exceed it within the
    hour, and once it does, Render sees the health check failing and
    restarts the service — which is exactly what happened in production
    once (see app/__init__.py's ProxyFix comment). Proves the exemption
    actually holds against the real configured limit, by first showing
    that limit really does fire against an ordinary route with the same
    request volume — not just that this test doesn't send enough requests
    to notice a regression.

    RATELIMIT_ENABLED has to be true before create_app() runs — flipping
    it on an already-built app/limiter doesn't retroactively enable
    enforcement — so this builds its own app instance instead of using the
    shared `app`/`client` fixtures, which are built once with it off.
    """

    class RateLimitedTestConfig(TestConfig):
        RATELIMIT_ENABLED = True

    flask_app = create_app(RateLimitedTestConfig)
    with flask_app.app_context():
        _db.create_all()
        try:
            client = flask_app.test_client()

            ordinary_statuses = [client.get("/api/public/doctors").status_code for _ in range(301)]
            assert 429 in ordinary_statuses, "expected the default 300/hour limit to kick in on an ordinary route"

            health_statuses = [client.get("/api/health").status_code for _ in range(301)]
            assert all(status == 200 for status in health_statuses)
        finally:
            _db.drop_all()
