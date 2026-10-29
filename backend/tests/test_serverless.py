"""The pieces that let Floss run as Vercel serverless functions: the reminders
endpoint an outside clock calls (a serverless app can't run a background
timer), the entrypoint Vercel loads, and the few settings that differ there.
"""
import importlib.util
import os
import subprocess
import sys
from datetime import datetime, timedelta

import pytest

from app import _start_reminder_scheduler
from app.extensions import db
from app.models import Appointment, Department, Doctor, PatientProfile

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SECRET = "test-cron-secret"


@pytest.fixture()
def cron_secret(app):
    app.config["CRON_SECRET"] = SECRET
    return SECRET


@pytest.fixture()
def due_appointment(app, register_user):
    _, user_id = register_user()
    patient = PatientProfile.query.filter_by(user_id=user_id).first()
    department = Department(name="General Dentistry")
    db.session.add(department)
    db.session.flush()
    doctor = Doctor(full_name="Dr. Amara Osei", department_id=department.id, specialty="General")
    db.session.add(doctor)
    db.session.flush()
    start = datetime.now() + timedelta(hours=5)
    appointment = Appointment(
        patient_id=patient.id, doctor_id=doctor.id, scheduled_start=start, scheduled_end=start + timedelta(minutes=30)
    )
    db.session.add(appointment)
    db.session.commit()
    return appointment


def _call(client, token=SECRET, method="post"):
    headers = {"Authorization": f"Bearer {token}"} if token is not None else {}
    return getattr(client, method)("/api/internal/send-reminders", headers=headers)


# --- reminders endpoint -----------------------------------------------------


def test_the_endpoint_is_switched_off_without_a_cron_secret(client, due_appointment):
    resp = _call(client)
    assert resp.status_code == 404
    assert db.session.get(Appointment, due_appointment.id).reminder_sent_at is None


@pytest.mark.parametrize("token", [None, "", "wrong-secret", SECRET + "x", "Bearer " + SECRET])
def test_it_rejects_a_missing_or_wrong_secret(client, cron_secret, due_appointment, token):
    resp = _call(client, token=token)
    assert resp.status_code == 401
    assert db.session.get(Appointment, due_appointment.id).reminder_sent_at is None


def test_it_sends_due_reminders_once(client, cron_secret, due_appointment):
    first = _call(client)
    assert first.status_code == 200
    assert first.get_json() == {"remindersSent": 1}
    assert db.session.get(Appointment, due_appointment.id).reminder_sent_at is not None

    again = _call(client)  # an outside clock may call as often as it likes
    assert again.get_json() == {"remindersSent": 0}


def test_get_works_too_because_vercel_cron_uses_get(client, cron_secret, due_appointment):
    resp = _call(client, method="get")
    assert resp.status_code == 200
    assert resp.get_json() == {"remindersSent": 1}


def test_a_user_login_token_cannot_trigger_it(client, cron_secret, due_appointment, register_user):
    other_headers, _ = register_user(email="other@example.com")
    resp = client.post("/api/internal/send-reminders", headers=other_headers)
    assert resp.status_code == 401
    assert db.session.get(Appointment, due_appointment.id).reminder_sent_at is None


# --- no background scheduler on Vercel --------------------------------------


def test_no_scheduler_starts_on_vercel(app, monkeypatch):
    started = []
    import apscheduler.schedulers.background as bg

    class _Spy:
        def __init__(self, *a, **kw):
            started.append("constructed")

        def add_job(self, *a, **kw):
            pass

        def start(self):
            started.append("started")

    monkeypatch.setattr(bg, "BackgroundScheduler", _Spy)
    monkeypatch.setitem(app.config, "TESTING", False)
    monkeypatch.setattr(sys, "argv", ["gunicorn"])  # would otherwise qualify as "serving traffic"
    monkeypatch.setenv("VERCEL", "1")

    _start_reminder_scheduler(app)

    assert started == []


# --- the entrypoint Vercel loads --------------------------------------------


def test_the_vercel_entrypoint_exposes_a_working_wsgi_app(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "sqlite:///:memory:")
    spec = importlib.util.spec_from_file_location("vercel_entrypoint", os.path.join(BACKEND_DIR, "api", "index.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    assert module.app.test_client().get("/api/health").get_json() == {"status": "ok"}


# --- settings that differ on Vercel -----------------------------------------


def _config_value(expression, **env):
    """Evaluates an expression against config.py in a fresh interpreter, since
    these are class attributes fixed at import time."""
    full_env = {**os.environ, **env}
    for key in ("VERCEL", "MAX_UPLOAD_MB", "DATABASE_URL"):
        if key not in env:
            full_env.pop(key, None)
    result = subprocess.run(
        [sys.executable, "-c", f"from config import Config; print({expression})"],
        cwd=BACKEND_DIR, env=full_env, capture_output=True, text=True, timeout=60,
    )
    assert result.returncode == 0, result.stderr
    return result.stdout.strip()


def test_uploads_are_capped_below_vercels_request_limit():
    assert _config_value("Config.MAX_UPLOAD_MB", VERCEL="1") == "4"
    assert _config_value("Config.MAX_UPLOAD_MB") == "20"
    assert _config_value("Config.MAX_UPLOAD_MB", VERCEL="1", MAX_UPLOAD_MB="2") == "2"  # still overridable


def test_postgres_connections_are_checked_before_use():
    options = _config_value("Config.SQLALCHEMY_ENGINE_OPTIONS", DATABASE_URL="postgresql://u:p@host/db")
    assert "'pool_pre_ping': True" in options and "'pool_recycle': 300" in options
    sqlite = _config_value("Config.SQLALCHEMY_ENGINE_OPTIONS", DATABASE_URL="sqlite:///x.db")
    assert "pool_pre_ping" not in sqlite and "'timeout': 10" in sqlite
