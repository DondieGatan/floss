"""Endpoints for the platform's own scheduled jobs, not for users.

On a long-running server (Render, `python run.py`) appointment reminders are
sent by an in-process scheduler (see app/__init__.py). A serverless function
can't run a background timer, so the same work is exposed here for an outside
clock to call: Vercel Cron (once a day on the free plan) and a GitHub Actions
schedule (every 15 minutes) — see vercel.json and .github/workflows/reminders.yml.

It is safe to call as often as you like: send_due_reminders() marks each
appointment once it has been reminded, so repeat calls send nothing new.
"""
import hmac

from flask import current_app, jsonify, request

from app.appointments.reminders import send_due_reminders
from app.extensions import limiter
from app.internal import internal_bp


def _authorized():
    """None when no CRON_SECRET is configured (endpoint switched off),
    otherwise whether the caller sent the matching bearer token. Vercel Cron
    sends `Authorization: Bearer $CRON_SECRET` on its own when that
    environment variable is set."""
    secret = current_app.config.get("CRON_SECRET")
    if not secret:
        return None
    supplied = request.headers.get("Authorization", "")
    return hmac.compare_digest(supplied.encode(), f"Bearer {secret}".encode())


@internal_bp.route("/send-reminders", methods=["GET", "POST"])
@limiter.exempt
def send_reminders():
    authorized = _authorized()
    if authorized is None:
        # Pretend it doesn't exist rather than advertise a disabled endpoint.
        return jsonify({"error": "Not found."}), 404
    if not authorized:
        return jsonify({"error": "Unauthorized."}), 401

    due = send_due_reminders()
    return jsonify({"remindersSent": len(due)}), 200
