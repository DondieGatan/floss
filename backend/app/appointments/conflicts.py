"""Appointment booking's availability/overlap checks, and the open-slot
computation used to drive the frontend's booking UI so it never has to
guess a valid time.
"""
from datetime import datetime, timedelta

from app.models import Appointment, DoctorAvailability


class AvailabilityError(Exception):
    """Requested slot falls outside the doctor's declared availability."""


class ConflictError(Exception):
    """Requested slot overlaps an existing non-cancelled appointment."""


def check_availability(doctor_id, start, end):
    """The requested [start, end) window must fit inside a SINGLE
    DoctorAvailability row for that weekday. Deliberate limitation: this
    doesn't stitch adjacent windows together (e.g. separate 9-11 and 11-1
    rows won't satisfy a 10-12 request) and has no concept of holiday/
    exception overrides — acceptable for this scope, not a bug."""
    weekday = start.weekday()
    window = (
        DoctorAvailability.query.filter_by(doctor_id=doctor_id, weekday=weekday)
        .filter(
            DoctorAvailability.start_time <= start.time(),
            DoctorAvailability.end_time >= end.time(),
        )
        .first()
    )
    if window is None:
        raise AvailabilityError("This time is outside the doctor's available hours.")


def check_no_overlap(doctor_id, start, end, exclude_appointment_id=None):
    """Half-open interval overlap against existing non-cancelled
    appointments for the doctor. Strict `<` (not `<=`) is what correctly
    allows back-to-back appointments — get this backwards and every
    appointment silently blocks the next one from starting exactly on time."""
    query = Appointment.query.filter(
        Appointment.doctor_id == doctor_id,
        Appointment.status != "cancelled",
        Appointment.scheduled_start < end,
        start < Appointment.scheduled_end,
    )
    if exclude_appointment_id is not None:
        query = query.filter(Appointment.id != exclude_appointment_id)
    if query.first() is not None:
        raise ConflictError("This doctor already has an appointment at that time.")


def compute_open_slots(doctor_id, date_, duration_minutes):
    """Returns a list of open slot-start datetimes for one calendar date,
    stepping through the doctor's availability windows at
    `duration_minutes` granularity and dropping any slot that overlaps an
    existing non-cancelled appointment. Lets the frontend only ever offer
    times that would actually pass check_availability/check_no_overlap."""
    weekday = date_.weekday()
    windows = DoctorAvailability.query.filter_by(doctor_id=doctor_id, weekday=weekday).all()
    if not windows:
        return []

    existing = Appointment.query.filter(
        Appointment.doctor_id == doctor_id,
        Appointment.status != "cancelled",
        Appointment.scheduled_start >= datetime.combine(date_, datetime.min.time()),
        Appointment.scheduled_start < datetime.combine(date_, datetime.min.time()) + timedelta(days=1),
    ).all()

    slots = []
    step = timedelta(minutes=duration_minutes)
    for window in windows:
        slot_start = datetime.combine(date_, window.start_time)
        window_end = datetime.combine(date_, window.end_time)
        while slot_start + step <= window_end:
            slot_end = slot_start + step
            overlaps = any(
                appt.scheduled_start < slot_end and slot_start < appt.scheduled_end for appt in existing
            )
            if not overlaps:
                slots.append(slot_start)
            slot_start += step

    return sorted(slots)
