"""Appointment reminders — see app/email.py for the delivery mechanism
(Resend, or a log-only fallback when no API key is configured). The
scheduling/dedup logic below is what's actually load-bearing; swapping
email providers only ever touches app/email.py, never this file.
"""
from datetime import datetime, timedelta

from flask import current_app

from app.extensions import db
from app.models import Appointment
from app.email import send_email

# Naive, matching scheduled_start (see appointments/routes.py and
# appointments/conflicts.py — this whole subsystem deals in naive
# datetimes, never tz-aware ones) so comparisons below don't raise.
REMINDER_WINDOW = timedelta(hours=24)


def _reminder_message(appointment):
    patient_name = appointment.patient.user.full_name if appointment.patient else "there"
    doctor_name = appointment.doctor.full_name if appointment.doctor else "your dentist"
    when = appointment.scheduled_start.strftime("%A, %B %d at %I:%M %p")
    return f"Hi {patient_name}, this is a reminder that you have an appointment with {doctor_name} on {when}."


def _reminder_email_html(appointment):
    patient_name = appointment.patient.user.full_name if appointment.patient else "there"
    doctor_name = appointment.doctor.full_name if appointment.doctor else "your dentist"
    when = appointment.scheduled_start.strftime("%A, %B %d at %I:%M %p")
    return f"""
    <div style="font-family: -apple-system, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; color: #222;">
      <h2 style="color: #2f6fed;">Floss Clinic</h2>
      <p>Hi {patient_name},</p>
      <p>This is a reminder that you have an appointment with <strong>{doctor_name}</strong> on
        <strong>{when}</strong>.</p>
      <p style="color: #666; font-size: 13px;">
        Need to reschedule or cancel? Sign in to your account to manage this appointment.
      </p>
    </div>
    """


def send_reminder_email(appointment):
    to = appointment.patient.user.email if appointment.patient and appointment.patient.user else None
    if not to:
        return
    sent = send_email(to, "Appointment reminder — Floss Clinic", _reminder_email_html(appointment))
    if not sent:
        current_app.logger.info(
            "Appointment reminder for %s (appointment #%s): %s", to, appointment.id, _reminder_message(appointment)
        )


def send_due_reminders():
    """Finds scheduled appointments starting within REMINDER_WINDOW that
    haven't been reminded yet, sends each one once, and marks it sent.
    Called periodically by the scheduler (see app/__init__.py) and directly
    in tests — this function is the actual unit of business logic, the
    scheduler is just what calls it on a clock."""
    now = datetime.now()
    due = Appointment.query.filter(
        Appointment.status == "scheduled",
        Appointment.reminder_sent_at.is_(None),
        Appointment.scheduled_start >= now,
        Appointment.scheduled_start <= now + REMINDER_WINDOW,
    ).all()

    for appointment in due:
        send_reminder_email(appointment)
        appointment.reminder_sent_at = now

    if due:
        db.session.commit()
    return due
