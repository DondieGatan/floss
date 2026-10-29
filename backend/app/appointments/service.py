"""Booking operations as plain functions, so callers other than the HTTP
routes (the assistant's confirmed actions, see app/agent/actions.py) apply
exactly the same availability and overlap rules.

Each function raises PastSlotError / AvailabilityError / ConflictError (see
conflicts.py) when the request can't be honoured, and commits on success.
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy.exc import IntegrityError

from app.appointments.confirmations import send_booking_confirmation_email
from app.appointments.conflicts import (
    ConflictError,
    check_availability,
    check_no_overlap,
    check_not_in_past,
)
from app.extensions import db
from app.models import Appointment


def book_appointment(patient, doctor, start, duration_minutes, reason=None):
    end = start + timedelta(minutes=duration_minutes)
    check_not_in_past(start)
    check_availability(doctor.id, start, end)
    check_no_overlap(doctor.id, start, end)

    appointment = Appointment(
        patient_id=patient.id,
        doctor_id=doctor.id,
        scheduled_start=start,
        scheduled_end=end,
        reason=reason,
    )
    db.session.add(appointment)
    try:
        db.session.commit()
    except IntegrityError as exc:
        # The partial unique index on (doctor_id, scheduled_start) caught a
        # same-instant double booking that slipped past check_no_overlap.
        db.session.rollback()
        raise ConflictError("This doctor already has an appointment at that time.") from exc
    send_booking_confirmation_email(appointment)
    return appointment


def reschedule_appointment(appointment, new_start, doctor_id=None):
    doctor_id = doctor_id or appointment.doctor_id
    new_end = new_start + (appointment.scheduled_end - appointment.scheduled_start)
    check_not_in_past(new_start)
    check_availability(doctor_id, new_start, new_end)
    check_no_overlap(doctor_id, new_start, new_end, exclude_appointment_id=appointment.id)

    appointment.scheduled_start = new_start
    appointment.scheduled_end = new_end
    appointment.doctor_id = doctor_id
    appointment.reminder_sent_at = None  # the new time gets its own reminder
    try:
        db.session.commit()
    except IntegrityError as exc:
        db.session.rollback()
        raise ConflictError("This doctor already has an appointment at that time.") from exc
    return appointment


def cancel_appointment(appointment, reason=None):
    appointment.status = "cancelled"
    appointment.cancelled_at = datetime.now(timezone.utc)
    appointment.cancellation_reason = reason or None
    db.session.commit()
    return appointment
