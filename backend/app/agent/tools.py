"""The booking assistant's tools.

Two rules shape everything here:
  1. Identity comes from the login token, never from the model. Every tool
     runs against ToolContext.patient — there is no patient_id argument a
     model (or a prompt-injected note) could set to reach someone else.
  2. Writes are only ever *proposed*. propose_* validates the request and
     stores an AgentAction; nothing in appointments changes until the patient
     confirms it (app/agent/actions.py).

Tools return plain dicts. A problem the model can fix (slot taken, unknown
id) comes back as {"error": "..."} so it can recover; the loop never lets a
tool exception escape.
"""
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta

from app.agent.limits import MAX_PENDING_ACTIONS, PENDING_TTL_MINUTES
from app.appointments.conflicts import (
    AvailabilityError,
    ConflictError,
    PastSlotError,
    check_availability,
    check_no_overlap,
    check_not_in_past,
    compute_open_slots,
)
from app.chat.injection_guard import log_if_suspicious
from app.extensions import db
from app.models import AgentAction, Appointment, Department, Doctor

MAX_SLOTS_RETURNED = 12
DEFAULT_DURATION_MINUTES = 30
MIN_DURATION_MINUTES = 15
MAX_DURATION_MINUTES = 120
MAX_REASON_CHARS = 300


@dataclass
class ToolContext:
    user_id: int
    patient: object
    conversation_id: int | None = None
    logger: object = None
    new_actions: list = field(default_factory=list)


class ToolError(Exception):
    """A request the model got wrong or the clinic can't honour — reported
    back to the model as {"error": message}."""


# Optional parameters are nullable on purpose: some models (and strict
# providers like Groq) send an explicit null for an argument they have no
# value for, and reject the call outright if the schema says "string only".
TOOL_SPECS = [
    {
        "name": "list_doctors",
        "description": "List the clinic's active dentists with their id, specialty and department. "
        "Optionally filter by department name.",
        "parameters": {
            "type": "object",
            "properties": {"department": {"type": ["string", "null"], "description": "Department name, e.g. Orthodontics."}},
        },
    },
    {
        "name": "get_open_slots",
        "description": "Get open appointment start times for one dentist on one date (clinic local time). "
        "Always call this before proposing a time.",
        "parameters": {
            "type": "object",
            "properties": {
                "doctor_id": {"type": "integer"},
                "date": {"type": "string", "description": "YYYY-MM-DD"},
                "duration_minutes": {"type": ["integer", "null"], "description": "Default 30."},
            },
            "required": ["doctor_id", "date"],
        },
    },
    {
        "name": "get_my_appointments",
        "description": "List this patient's own appointments (upcoming first), with their ids.",
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "name": "propose_booking",
        "description": "Propose a new appointment. This does NOT book it: it creates a pending request that "
        "the patient must confirm in the chat. Use a start time returned by get_open_slots.",
        "parameters": {
            "type": "object",
            "properties": {
                "doctor_id": {"type": "integer"},
                "start": {"type": "string", "description": "Local start time, ISO format, e.g. 2026-11-02T10:00"},
                "duration_minutes": {"type": ["integer", "null"], "description": "Default 30."},
                "reason": {"type": ["string", "null"], "description": "Short reason for the visit, in the patient's words."},
            },
            "required": ["doctor_id", "start"],
        },
    },
    {
        "name": "propose_reschedule",
        "description": "Propose moving one of the patient's scheduled appointments to a new start time. "
        "Does NOT change it: the patient must confirm.",
        "parameters": {
            "type": "object",
            "properties": {
                "appointment_id": {"type": "integer"},
                "new_start": {"type": "string", "description": "Local start time, ISO format."},
            },
            "required": ["appointment_id", "new_start"],
        },
    },
    {
        "name": "propose_cancel",
        "description": "Propose cancelling one of the patient's scheduled appointments. "
        "Does NOT cancel it: the patient must confirm.",
        "parameters": {
            "type": "object",
            "properties": {
                "appointment_id": {"type": "integer"},
                "reason": {"type": ["string", "null"]},
            },
            "required": ["appointment_id"],
        },
    },
]


def _int_arg(args, key):
    value = args.get(key)
    if isinstance(value, bool) or not isinstance(value, int):
        raise ToolError(f"{key} must be an integer.")
    return value


def _parse_local_datetime(raw, key):
    try:
        value = datetime.fromisoformat(raw)
    except (TypeError, ValueError):
        raise ToolError(f"{key} must be an ISO date-time like 2026-11-02T10:00.") from None
    if value.tzinfo is not None:
        raise ToolError(f"{key} must be local clinic time, without a timezone.")
    return value.replace(second=0, microsecond=0)


def _duration(args):
    value = args.get("duration_minutes")
    if value is None:  # optional: models often send null instead of omitting it
        value = DEFAULT_DURATION_MINUTES
    if isinstance(value, bool) or not isinstance(value, int) or not (MIN_DURATION_MINUTES <= value <= MAX_DURATION_MINUTES):
        raise ToolError(f"duration_minutes must be a whole number from {MIN_DURATION_MINUTES} to {MAX_DURATION_MINUTES}.")
    return value


def _active_doctor(doctor_id):
    doctor = db.session.get(Doctor, doctor_id)
    if doctor is None or not doctor.is_active:
        raise ToolError("No active dentist with that id. Call list_doctors to see valid ids.")
    return doctor


def _own_scheduled_appointment(ctx, appointment_id):
    # Same 404-style idiom as the rest of the app: someone else's appointment
    # is indistinguishable from one that doesn't exist.
    appointment = Appointment.query.filter_by(id=appointment_id, patient_id=ctx.patient.id).first()
    if appointment is None:
        raise ToolError("No appointment with that id on this patient's account.")
    if appointment.status != "scheduled":
        raise ToolError(f"That appointment is {appointment.status}, so it can't be changed.")
    return appointment


def _validate_slot(doctor_id, start, end, exclude_appointment_id=None):
    try:
        check_not_in_past(start)
        check_availability(doctor_id, start, end)
        check_no_overlap(doctor_id, start, end, exclude_appointment_id=exclude_appointment_id)
    except (PastSlotError, AvailabilityError, ConflictError) as exc:
        raise ToolError(str(exc)) from None


def _pretty(dt):
    return dt.strftime("%A, %B %d, %Y at %I:%M %p")


def _create_action(ctx, kind, params, summary):
    now = datetime.now()
    live = AgentAction.query.filter(
        AgentAction.user_id == ctx.user_id, AgentAction.status == "pending", AgentAction.expires_at > now
    ).count()
    if live >= MAX_PENDING_ACTIONS:
        raise ToolError("There are already several requests waiting for the patient to confirm or reject.")
    action = AgentAction(
        user_id=ctx.user_id,
        conversation_id=ctx.conversation_id,
        kind=kind,
        params=params,
        summary=summary,
        expires_at=now + timedelta(minutes=PENDING_TTL_MINUTES),
    )
    db.session.add(action)
    db.session.commit()
    ctx.new_actions.append(action)
    return {
        "status": "awaiting_user_confirmation",
        "actionId": action.id,
        "summary": summary,
        "instruction": "Nothing has been changed yet. Tell the patient to press Confirm on the request to go ahead.",
    }


def list_doctors(ctx, args):
    query = Doctor.query.filter_by(is_active=True).join(Department)
    department = args.get("department")
    if isinstance(department, str) and department.strip():
        query = query.filter(db.func.lower(Department.name) == department.strip().lower())
    doctors = query.order_by(Doctor.full_name).limit(30).all()
    return {
        "doctors": [
            {"id": d.id, "name": d.full_name, "specialty": d.specialty, "department": d.department.name}
            for d in doctors
        ]
    }


def get_open_slots(ctx, args):
    doctor = _active_doctor(_int_arg(args, "doctor_id"))
    try:
        day = date.fromisoformat(args.get("date"))
    except (TypeError, ValueError):
        raise ToolError("date must be YYYY-MM-DD.") from None
    duration = _duration(args)
    slots = compute_open_slots(doctor.id, day, duration) if day >= date.today() else []
    return {
        "doctorId": doctor.id,
        "doctorName": doctor.full_name,
        "date": day.isoformat(),
        "durationMinutes": duration,
        "openSlots": [s.strftime("%Y-%m-%dT%H:%M") for s in slots[:MAX_SLOTS_RETURNED]],
        "moreSlotsNotShown": max(0, len(slots) - MAX_SLOTS_RETURNED),
    }


def get_my_appointments(ctx, args):
    now = datetime.now()
    upcoming = (
        Appointment.query.filter(
            Appointment.patient_id == ctx.patient.id,
            Appointment.status == "scheduled",
            Appointment.scheduled_start >= now,
        )
        .order_by(Appointment.scheduled_start)
        .limit(8)
        .all()
    )
    recent = (
        Appointment.query.filter(Appointment.patient_id == ctx.patient.id, Appointment.scheduled_start < now)
        .order_by(Appointment.scheduled_start.desc())
        .limit(3)
        .all()
    )
    return {
        "appointments": [
            {
                "id": a.id,
                "start": a.scheduled_start.strftime("%Y-%m-%dT%H:%M"),
                "doctor": a.doctor.full_name if a.doctor else None,
                "status": a.status,
                # The patient's own free text: data, never instructions (see the system prompt).
                "reasonNote": a.reason,
            }
            for a in upcoming + recent
        ]
    }


def propose_booking(ctx, args):
    doctor = _active_doctor(_int_arg(args, "doctor_id"))
    start = _parse_local_datetime(args.get("start"), "start")
    duration = _duration(args)
    reason = args.get("reason")
    reason = reason.strip()[:MAX_REASON_CHARS] if isinstance(reason, str) and reason.strip() else None
    if reason:
        log_if_suspicious(ctx.logger, ctx.user_id, "agent_booking_reason", reason)
    _validate_slot(doctor.id, start, start + timedelta(minutes=duration))
    summary = f"Book {doctor.full_name} on {_pretty(start)} ({duration} min)"
    return _create_action(
        ctx,
        "book",
        {
            "doctorId": doctor.id,
            "scheduledStart": start.isoformat(),
            "durationMinutes": duration,
            "reason": reason,
        },
        summary,
    )


def propose_reschedule(ctx, args):
    appointment = _own_scheduled_appointment(ctx, _int_arg(args, "appointment_id"))
    new_start = _parse_local_datetime(args.get("new_start"), "new_start")
    new_end = new_start + (appointment.scheduled_end - appointment.scheduled_start)
    _validate_slot(appointment.doctor_id, new_start, new_end, exclude_appointment_id=appointment.id)
    summary = (
        f"Move your appointment with {appointment.doctor.full_name} from "
        f"{_pretty(appointment.scheduled_start)} to {_pretty(new_start)}"
    )
    return _create_action(
        ctx,
        "reschedule",
        {"appointmentId": appointment.id, "scheduledStart": new_start.isoformat()},
        summary,
    )


def propose_cancel(ctx, args):
    appointment = _own_scheduled_appointment(ctx, _int_arg(args, "appointment_id"))
    reason = args.get("reason")
    reason = reason.strip()[:MAX_REASON_CHARS] if isinstance(reason, str) and reason.strip() else None
    summary = f"Cancel your appointment with {appointment.doctor.full_name} on {_pretty(appointment.scheduled_start)}"
    return _create_action(ctx, "cancel", {"appointmentId": appointment.id, "reason": reason}, summary)


_EXECUTORS = {
    "list_doctors": list_doctors,
    "get_open_slots": get_open_slots,
    "get_my_appointments": get_my_appointments,
    "propose_booking": propose_booking,
    "propose_reschedule": propose_reschedule,
    "propose_cancel": propose_cancel,
}


def execute_tool(ctx, name, args):
    """Runs one tool call. Never raises: a bad call becomes an error result
    the model can read and correct."""
    executor = _EXECUTORS.get(name)
    if executor is None:
        return {"error": f"Unknown tool '{name}'."}
    if not isinstance(args, dict):
        return {"error": "Tool arguments must be an object."}
    try:
        return executor(ctx, args)
    except ToolError as exc:
        return {"error": str(exc)}
    except Exception:  # noqa: BLE001 - a tool bug must not take down the chat request
        db.session.rollback()
        if ctx.logger:
            ctx.logger.exception("Agent tool %s failed", name)
        return {"error": "That lookup failed. Please try again or ask the patient to book from the Appointments page."}
