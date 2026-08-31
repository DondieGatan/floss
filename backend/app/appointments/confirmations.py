"""Booking-confirmation email, sent once right after an appointment is
created. See app/email.py for the delivery mechanism (SendGrid, Resend, or
a log-only fallback) — send_email() never raises, so a failed/unconfigured
send degrades to "no email" rather than breaking the booking request.
"""
from flask import current_app

from app.email import send_email


def _confirmation_email_html(appointment):
    patient_name = appointment.patient.user.full_name if appointment.patient else "there"
    doctor_name = appointment.doctor.full_name if appointment.doctor else "your dentist"
    when = appointment.scheduled_start.strftime("%A, %B %d at %I:%M %p")
    reason_row = (
        f'<p><strong>Reason:</strong> {appointment.reason}</p>' if appointment.reason else ""
    )
    return f"""
    <div style="font-family: -apple-system, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; color: #222;">
      <h2 style="color: #2f6fed;">Floss Clinic</h2>
      <p>Hi {patient_name},</p>
      <p>Your appointment with <strong>{doctor_name}</strong> is confirmed for
        <strong>{when}</strong>.</p>
      {reason_row}
      <p style="color: #666; font-size: 13px;">
        Need to reschedule or cancel? Sign in to your account to manage this appointment.
      </p>
    </div>
    """


def send_booking_confirmation_email(appointment):
    to = appointment.patient.user.email if appointment.patient and appointment.patient.user else None
    if not to:
        return
    sent = send_email(to, "Appointment confirmed — Floss Clinic", _confirmation_email_html(appointment))
    if not sent:
        when = appointment.scheduled_start.strftime("%A, %B %d at %I:%M %p")
        current_app.logger.info(
            "Booking confirmation for %s (appointment #%s): confirmed for %s", to, appointment.id, when
        )
