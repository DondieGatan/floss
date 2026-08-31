"""Outbound email via SendGrid or the Resend API.

Lazy-configured like GEMINI_API_KEY/HF_TOKEN elsewhere in this app (see
config.py) — send_email() logs the message instead of sending it when
neither provider is set, so password reset and appointment reminders stay
fully usable locally and in tests without a real account. Set a real key
(as a Render env var, or in .env locally) to actually deliver.

SendGrid is tried first when configured. Resend's free tier can only
deliver to the email address the Resend account itself was signed up
with, not to arbitrary recipients, until a full domain is verified —
confirmed directly against this app's own Resend key: sending to any
address other than the account owner's own 403s with "You can only send
testing emails to your own email address". SendGrid's free tier only
needs one sender email verified (no domain/DNS) and then delivers to any
recipient, so it's the one that actually works for real users.
"""
import httpx
from flask import current_app

_SENDGRID_API_URL = "https://api.sendgrid.com/v3/mail/send"
_RESEND_API_URL = "https://api.resend.com/emails"


def is_configured():
    return bool(current_app.config.get("SENDGRID_API_KEY") or current_app.config.get("RESEND_API_KEY"))


def send_email(to, subject, html_body):
    """Sends an email via SendGrid or Resend, or logs it if neither API key
    is configured. Never raises — a failed or unconfigured send should
    degrade to "the user doesn't get an email" rather than break whatever
    request triggered it (a booking, a password-reset request, etc).
    Returns whether it was actually sent."""
    sendgrid_key = current_app.config.get("SENDGRID_API_KEY")
    resend_key = current_app.config.get("RESEND_API_KEY")

    if not sendgrid_key and not resend_key:
        current_app.logger.info("Email (no provider configured) to %s — %s:\n%s", to, subject, html_body)
        return False

    try:
        if sendgrid_key:
            response = httpx.post(
                _SENDGRID_API_URL,
                headers={"Authorization": f"Bearer {sendgrid_key}"},
                json={
                    "personalizations": [{"to": [{"email": to}]}],
                    "from": {"email": current_app.config["SENDGRID_FROM"]},
                    "subject": subject,
                    "content": [{"type": "text/html", "value": html_body}],
                },
                timeout=10,
            )
        else:
            response = httpx.post(
                _RESEND_API_URL,
                headers={"Authorization": f"Bearer {resend_key}"},
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
