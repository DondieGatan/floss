"""Covers _start_reminder_scheduler's guard logic in isolation — the actual
bug this locks down: create_app() runs for `flask db migrate`/`upgrade`,
seed.py, etc. too, not just for serving traffic, and the scheduler must
never start for any of those (it did, once, and broke a migration against
a column it hadn't been created yet — see app/__init__.py's docstring)."""
import pytest

from app import _start_reminder_scheduler, create_app
from config import TestConfig


class _NonTestConfig(TestConfig):
    # Only TESTING flips back off — inherits the rest (in-memory DB, etc.)
    # so no real server/DB is actually touched by these guard-only checks.
    TESTING = False


@pytest.fixture()
def non_testing_app():
    flask_app = create_app(_NonTestConfig)
    flask_app.debug = False
    return flask_app


@pytest.fixture()
def scheduler_spy(monkeypatch):
    calls = []

    class _FakeScheduler:
        def __init__(self, *a, **kw):
            calls.append("constructed")

        def add_job(self, *a, **kw):
            pass

        def start(self):
            calls.append("started")

    import apscheduler.schedulers.background as bg
    monkeypatch.setattr(bg, "BackgroundScheduler", _FakeScheduler)
    return calls


@pytest.mark.parametrize(
    "argv0",
    [
        r"D:\project\backend\venv\Scripts\flask",
        r"D:\project\backend\venv\Scripts\flask.exe",
        "pytest",
    ],
)
def test_does_not_start_for_non_server_invocations(non_testing_app, scheduler_spy, monkeypatch, argv0):
    monkeypatch.setattr("sys.argv", [argv0])
    _start_reminder_scheduler(non_testing_app)
    assert scheduler_spy == []


def test_does_not_start_under_testing_config(app, scheduler_spy, monkeypatch):
    # `app` fixture already uses TestConfig (TESTING=True) — argv doesn't
    # matter, TESTING alone must be enough to skip it.
    monkeypatch.setattr("sys.argv", ["run.py"])
    _start_reminder_scheduler(app)
    assert scheduler_spy == []


@pytest.mark.parametrize("argv0", ["run.py", r"C:\app\venv\Scripts\gunicorn"])
def test_starts_for_real_server_entrypoints(non_testing_app, scheduler_spy, monkeypatch, argv0):
    monkeypatch.setattr("sys.argv", [argv0])
    _start_reminder_scheduler(non_testing_app)
    assert scheduler_spy == ["constructed", "started"]


def test_does_not_start_for_reloader_watcher_process(non_testing_app, scheduler_spy, monkeypatch):
    # debug=True with WERKZEUG_RUN_MAIN unset/false is the reloader's
    # watcher process — the one that must NOT start a scheduler, only the
    # actual worker it spawns (which sets WERKZEUG_RUN_MAIN=true) should.
    non_testing_app.debug = True
    monkeypatch.setattr("sys.argv", ["run.py"])
    monkeypatch.delenv("WERKZEUG_RUN_MAIN", raising=False)
    _start_reminder_scheduler(non_testing_app)
    assert scheduler_spy == []
