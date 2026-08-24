"""Live per-user account facts injected into the chat prompt as trusted
first-party context, separate from the numbered, citable knowledge-base
passages — lets the assistant answer "what's my next appointment?" without
that ever needing to live in an uploaded document.

Scoped strictly by PatientProfile.user_id, which is the same identity
current_user_id() already provides for every other ownership check in this
app (Conversation.owner_id, Appointment cancel/reschedule, etc.) — there is
no code path here that can pull another patient's data. Returns None for
staff/admin, who have no PatientProfile.
"""
from datetime import datetime, timezone

from app.models import Appointment, PatientProfile

MAX_APPOINTMENTS = 8

# Every patient gets a PatientProfile at registration (see
# app/auth/routes.py:register), so "has a profile" can't be the signal for
# whether to spend a DB lookup + bypass the low-confidence fallback — nearly
# every patient message would qualify, including ones with nothing to do
# with their own account. This is a deliberately simple keyword gate (this
# app doesn't do ML-based intent detection anywhere else) rather than a
# real classifier — it only needs to catch the obvious phrasings.
_PERSONAL_KEYWORDS = (
    "my appointment", "my appointments", "my visit", "my visits", "my schedule",
    "my booking", "my bookings", "my dentist", "my timing", "my time",
    "reschedule", "cancel my",
    "next appointment", "upcoming appointment", "upcoming appointments",
    "appointment today", "appointment for today", "today's appointment", "todays appointment",
    "when is my", "when's my", "what time is my", "what date is my",
    "do i have", "am i due",
)


def is_personal_query(query):
    q = query.lower()
    return any(keyword in q for keyword in _PERSONAL_KEYWORDS)


def build_account_context(user_id, query):
    """Returns a plain-text block for build_prompt(), or None if this
    doesn't look like a question about the user's own account (cheapest
    check, skips the DB lookup entirely) or the user has no patient profile
    (staff/admin)."""
    if not is_personal_query(query):
        return None

    patient = PatientProfile.query.filter_by(user_id=user_id).first()
    if patient is None:
        return None

    now = datetime.now(timezone.utc)
    lines = [f"Current date and time: {now.strftime('%A, %B %d, %Y %I:%M %p')} UTC."]

    appointments = (
        Appointment.query.filter_by(patient_id=patient.id)
        .order_by(Appointment.scheduled_start.desc())
        .limit(MAX_APPOINTMENTS)
        .all()
    )

    if not appointments:
        lines.append("This patient has no appointments on file.")
    else:
        lines.append("This patient's own appointments, most recent first:")
        for appt in appointments:
            when = appt.scheduled_start.strftime("%A, %B %d, %Y at %I:%M %p")
            doctor_name = appt.doctor.full_name if appt.doctor else "an unassigned dentist"
            line = f"- {when} with {doctor_name} (status: {appt.status})"
            if appt.reason:
                line += f", reason noted: {appt.reason}"
            lines.append(line)

    return "\n".join(lines)
