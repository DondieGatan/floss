"""Resolving a proposed action — the only code path through which the
assistant's suggestions ever change an appointment, and only after the
patient explicitly confirms.

Confirmation re-runs the real booking rules rather than trusting the
validation done when the action was proposed: the slot may have been taken
(or the clock passed it) in the meantime.
"""
from datetime import datetime

from app.appointments.conflicts import AvailabilityError, ConflictError, PastSlotError
from app.appointments.service import book_appointment, cancel_appointment, reschedule_appointment
from app.extensions import db
from app.models import AgentAction, Appointment, AuditLog, Doctor, Message


class ActionError(Exception):
    """The action can't be resolved right now. `status_code` is what the
    route should answer with."""

    def __init__(self, message, status_code=409):
        super().__init__(message)
        self.status_code = status_code


def get_own_action(user_id, action_id):
    return AgentAction.query.filter_by(id=action_id, user_id=user_id).first()


def _expire_if_stale(action):
    if action.status == "pending" and action.expires_at <= datetime.now():
        action.status = "expired"
        action.resolved_at = datetime.now()
        db.session.commit()


def _require_pending(action):
    _expire_if_stale(action)
    if action.status != "pending":
        raise ActionError(f"This request is already {action.status}.")


def _record(action, status, message, appointment_id=None):
    action.status = status
    action.resolved_at = datetime.now()
    action.result_message = message[:300]
    if appointment_id:
        action.appointment_id = appointment_id
    if action.conversation_id:
        # Keeps the transcript honest for later turns: the model sees what
        # actually happened, not just what it proposed.
        db.session.add(Message(conversation_id=action.conversation_id, role="assistant", content=message))
    db.session.commit()


def _run(action, patient):
    """Executes the stored proposal. Raises the booking-rule exceptions."""
    params = action.params
    if action.kind == "book":
        doctor = db.session.get(Doctor, params["doctorId"])
        if doctor is None or not doctor.is_active:
            raise ConflictError("That dentist is no longer available.")
        appointment = book_appointment(
            patient,
            doctor,
            datetime.fromisoformat(params["scheduledStart"]),
            params["durationMinutes"],
            params.get("reason"),
        )
        return appointment, f"Confirmed: {action.summary}."

    appointment = Appointment.query.filter_by(id=params["appointmentId"], patient_id=patient.id).first()
    if appointment is None or appointment.status != "scheduled":
        raise ConflictError("That appointment can no longer be changed.")
    if action.kind == "reschedule":
        appointment = reschedule_appointment(appointment, datetime.fromisoformat(params["scheduledStart"]))
        return appointment, f"Confirmed: {action.summary}."
    appointment = cancel_appointment(appointment, params.get("reason"))
    return appointment, f"Confirmed: {action.summary}."


def confirm_action(action, patient):
    _require_pending(action)
    try:
        appointment, message = _run(action, patient)
    except (PastSlotError, AvailabilityError, ConflictError) as exc:
        db.session.rollback()
        _record(action, "failed", f"That change could not be made: {exc} Please ask for another time.")
        raise ActionError(str(exc), 409) from None

    db.session.add(
        AuditLog(
            actor_id=action.user_id,
            action=f"agent_{action.kind}_confirmed",
            target_user_id=action.user_id,
            details=f"appointment #{appointment.id}, action #{action.id}",
        )
    )
    _record(action, "confirmed", message, appointment_id=appointment.id)
    return action


def reject_action(action):
    _require_pending(action)
    _record(action, "rejected", f"Okay, I won't go ahead with that: {action.summary}.")
    return action
