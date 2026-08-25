"""Appointment reminders.

No real email provider is wired up yet (same gap as auth/routes.py's
forgot_password — see its comment) — send_reminder_email logs the message
it would send instead of actually delivering it, so the scheduling/dedup
logic here is real and testable today, and swapping in a real provider
(SendGrid/SES/SMTP) later only touches this one function.
"""
from datetime import datetime, timedelta

from flask import current_app

from app.extensions import db
from app.models import Appointment

# Naive, matching scheduled_start (see appointments/routes.py and
# appointments/conflicts.py — this whole subsystem deals in naive
# datetimes, never tz-aware ones) so comparisons below don't raise.
REMINDER_WINDOW = timedelta(hours=24)


def _reminder_message(appointment):
    patient_name = appointment.patient.user.full_name if appointment.patient else "there"
    doctor_name = appointment.doctor.full_name if appointment.doctor else "your dentist"
    when = appointment.scheduled_start.strftime("%A, %B %d at %I:%M %p")
    return f"Hi {patient_name}, this is a reminder that you have an appointment with {doctor_name} on {when}."


def send_reminder_email(appointment):
    to = appointment.patient.user.email if appointment.patient and appointment.patient.user else None
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
