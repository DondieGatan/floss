"""Outbound email via the Resend API.

Lazy-configured like GEMINI_API_KEY/HF_TOKEN elsewhere in this app (see
config.py) — send_email() logs the message instead of sending it when
RESEND_API_KEY isn't set, so password reset and appointment reminders stay
fully usable locally and in tests without a real account. Set a real key
(as a Render env var, or in .env locally) to actually deliver.
"""
import httpx
from flask import current_app

_API_URL = "https://api.resend.com/emails"


def is_configured():
    return bool(current_app.config.get("RESEND_API_KEY"))


def send_email(to, subject, html_body):
    """Sends an email via Resend, or logs it if no API key is configured.
    Never raises — a failed or unconfigured send should degrade to "the
    user doesn't get an email" rather than break whatever request
    triggered it (a booking, a password-reset request, etc). Returns
    whether it was actually sent."""
    api_key = current_app.config.get("RESEND_API_KEY")
    if not api_key:
        current_app.logger.info("Email (no provider configured) to %s — %s:\n%s", to, subject, html_body)
        return False

    try:
        response = httpx.post(
            _API_URL,
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "from": current_app.config["EMAIL_FROM_ADDRESS"],
                "to": [to],
                "subject": subject,
                "html": html_body,
            },
            timeout=10,
        )
        response.raise_for_status()
        return True
    except httpx.HTTPError:
        current_app.logger.exception("Failed to send email to %s", to)
        return False
