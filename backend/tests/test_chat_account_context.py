import re
from datetime import date, datetime, timedelta

from app.chat.account_context import build_account_context, is_personal_query


def _next_weekday(weekday):
    today = date.today()
    days_ahead = (weekday - today.weekday()) % 7
    days_ahead = days_ahead or 7
    return today + timedelta(days=days_ahead)


MONDAY = _next_weekday(0)


def _make_doctor(client, staff_headers):
    dept_id = client.post(
        "/api/departments", headers=staff_headers, json={"name": "General"}
    ).get_json()["department"]["id"]
    doctor_id = client.post(
        "/api/doctors",
        headers=staff_headers,
        json={"fullName": "Dr. Jane Smith", "departmentId": dept_id, "specialty": "General"},
    ).get_json()["doctor"]["id"]
    client.post(
        f"/api/doctors/{doctor_id}/availability",
        headers=staff_headers,
        json={"weekday": 0, "startTime": "09:00", "endTime": "13:00"},
    )
    return doctor_id


def _book(client, headers, doctor_id, start, reason="Checkup"):
    resp = client.post(
        "/api/appointments",
        headers=headers,
        json={"doctorId": doctor_id, "scheduledStart": start.isoformat(), "durationMinutes": 30, "reason": reason},
    )
    assert resp.status_code == 201
    return resp.get_json()["appointment"]


def test_is_personal_query_matches_common_phrasings():
    assert is_personal_query("whats my next appointment?")
    assert is_personal_query("Can I reschedule?")
    assert is_personal_query("I need to cancel my visit")
    assert is_personal_query("What's my appointment today?")
    assert is_personal_query("Do I have any upcoming appointments?")
    assert is_personal_query("What time is my appointment?")
    assert not is_personal_query("What are your hours?")
    assert not is_personal_query("Do you take insurance?")
    assert not is_personal_query("Tell me about your dentists")


def test_account_context_none_for_non_personal_query(app, register_user):
    _headers, user_id = register_user()
    with app.app_context():
        assert build_account_context(user_id, "What are your hours?") is None


def test_account_context_none_for_staff_without_patient_profile(app, register_staff):
    _headers, user_id = register_staff()
    with app.app_context():
        assert build_account_context(user_id, "what's my next appointment?") is None


def test_account_context_reports_naive_current_time_not_utc(app, register_user):
    """Must stay directly comparable to the naive appointment times listed
    right below it in the same block (see conflicts.py/reminders.py's
    identical naive convention) — datetime.now(timezone.utc) would silently
    disagree with them by the server's UTC offset on any server not
    actually running in UTC, which is exactly the bug this guards
    against."""
    _headers, user_id = register_user()
    before = datetime.now()
    with app.app_context():
        context = build_account_context(user_id, "what's my next appointment?")
    after = datetime.now()

    match = re.search(r"Current date and time: (.+?)\.", context)
    assert match is not None
    reported = datetime.strptime(match.group(1), "%A, %B %d, %Y %I:%M %p")
    assert before - timedelta(minutes=1) <= reported <= after + timedelta(minutes=1)


def test_account_context_reports_no_appointments(app, register_user):
    _headers, user_id = register_user()
    with app.app_context():
        context = build_account_context(user_id, "what's my next appointment?")
    assert context is not None
    assert "no appointments on file" in context.lower()


def test_account_context_includes_own_appointment(client, staff_headers, register_user, app):
    headers, user_id = register_user(email="patient-a@example.com")
    doctor_id = _make_doctor(client, staff_headers)
    start = datetime.combine(MONDAY, datetime.min.time()).replace(hour=9, minute=0)
    _book(client, headers, doctor_id, start, reason="Routine cleaning")

    with app.app_context():
        context = build_account_context(user_id, "what's my next appointment?")

    assert "Dr. Jane Smith" in context
    assert "Routine cleaning" in context
    assert "scheduled" in context.lower()


def test_account_context_never_leaks_another_patients_appointment(client, staff_headers, register_user, app):
    # Patient A books a very identifiable appointment.
    headers_a, _user_id_a = register_user(email="patient-a@example.com")
    doctor_id = _make_doctor(client, staff_headers)
    start = datetime.combine(MONDAY, datetime.min.time()).replace(hour=9, minute=0)
    _book(client, headers_a, doctor_id, start, reason="Patient A's confidential reason")

    # Patient B has their own profile (auto-created at registration) but no
    # appointments — their account context must never mention A's booking.
    _headers_b, user_id_b = register_user(email="patient-b@example.com")

    with app.app_context():
        context_b = build_account_context(user_id_b, "what's my next appointment?")

    assert context_b is not None
    assert "no appointments on file" in context_b.lower()
    assert "Patient A's confidential reason" not in context_b
    assert "Dr. Jane Smith" not in context_b


def test_post_message_uses_account_context_in_prompt(client, auth_headers, mock_stream_answer):
    # No documents exist at all (retrieve() returns nothing -> low
    # confidence), but the query is personal and the user has a patient
    # profile — the account context block should still reach the model.
    conv_id = client.post("/api/chat/conversations", headers=auth_headers, json={}).get_json()["conversation"]["id"]

    resp = client.post(
        f"/api/chat/conversations/{conv_id}/messages",
        headers=auth_headers,
        json={"content": "what's my next appointment?"},
    )
    assert resp.status_code == 200
    mock_stream_answer.assert_called_once()

    # The prompt actually sent to the model must carry the account context,
    # not just an empty source-passages block. Gemini's API takes the prompt
    # as {"system_instruction": ..., "contents": ...}, not a message list.
    prompt = mock_stream_answer.call_args[0][0]
    user_content = prompt["contents"]
    assert "<account_context>" in user_content
    assert "no appointments on file" in user_content.lower()


def test_post_message_omits_account_context_for_unrelated_low_confidence_query(
    client, auth_headers, mock_stream_answer
):
    # A registered patient (has a PatientProfile) asking something with no
    # matching documents and no personal-account phrasing should still call
    # the model (it can fall back to general dental knowledge), just without
    # any account context or citable source passages in the prompt.
    conv_id = client.post("/api/chat/conversations", headers=auth_headers, json={}).get_json()["conversation"]["id"]

    resp = client.post(
        f"/api/chat/conversations/{conv_id}/messages", headers=auth_headers, json={"content": "Anything at all"}
    )
    assert resp.status_code == 200
    mock_stream_answer.assert_called_once()

    prompt = mock_stream_answer.call_args[0][0]
    user_content = prompt["contents"]
    assert "<account_context>" not in user_content
    assert "(no relevant knowledge-base passages found)" in user_content
