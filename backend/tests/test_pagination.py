from app.models import User
from app.pagination import paginate, DEFAULT_PER_PAGE, MAX_PER_PAGE


def _make_users(n, prefix="user"):
    from app.extensions import db

    for i in range(n):
        u = User(full_name=f"{prefix}{i:02d}", email=f"{prefix}{i}@example.com")
        u.set_password("password123")
        db.session.add(u)
    db.session.commit()


def test_paginate_defaults_and_clamps(app):
    _make_users(5)
    with app.test_request_context("/"):
        items, meta = paginate(User.query.order_by(User.full_name))
        assert meta == {"page": 1, "perPage": DEFAULT_PER_PAGE, "total": 5, "hasMore": False}
        assert len(items) == 5

    with app.test_request_context("/?page=0&perPage=0"):
        items, meta = paginate(User.query.order_by(User.full_name))
        assert meta["page"] == 1
        assert meta["perPage"] == 1

    with app.test_request_context(f"/?perPage={MAX_PER_PAGE + 500}"):
        items, meta = paginate(User.query.order_by(User.full_name))
        assert meta["perPage"] == MAX_PER_PAGE


def test_paginate_slices_and_reports_has_more(app):
    _make_users(7)
    with app.test_request_context("/?page=1&perPage=3"):
        items, meta = paginate(User.query.order_by(User.full_name))
        assert [u.full_name for u in items] == ["user00", "user01", "user02"]
        assert meta == {"page": 1, "perPage": 3, "total": 7, "hasMore": True}

    with app.test_request_context("/?page=3&perPage=3"):
        items, meta = paginate(User.query.order_by(User.full_name))
        assert [u.full_name for u in items] == ["user06"]
        assert meta["hasMore"] is False


def test_list_users_is_paginated(client, admin_headers, register_staff):
    # /api/users only ever lists staff/admin/owner (see app/users/routes.py)
    # — patients are excluded, so the extras here must be staff too.
    for i in range(3):
        register_staff(email=f"extra{i}@example.com", full_name=f"Extra {i}", role="staff")

    resp = client.get("/api/users?perPage=2", headers=admin_headers)
    data = resp.get_json()
    assert len(data["users"]) == 2
    assert data["perPage"] == 2
    assert data["total"] >= 4  # 3 extras + the admin itself
    assert data["hasMore"] is True

    resp_all = client.get("/api/users?perPage=200", headers=admin_headers)
    assert resp_all.get_json()["hasMore"] is False


def test_list_patients_is_paginated(client, staff_headers, register_user):
    for i in range(3):
        register_user(email=f"patient-extra{i}@example.com", full_name=f"Patient Extra {i}")

    resp = client.get("/api/patients?perPage=2", headers=staff_headers)
    data = resp.get_json()
    assert len(data["patients"]) == 2
    assert data["total"] >= 3
    assert data["hasMore"] is True


def _make_doctor_with_monday_availability(client, staff_headers):
    dept_id = client.post(
        "/api/departments", headers=staff_headers, json={"name": "Pagination Test Dept"}
    ).get_json()["department"]["id"]
    doctor_id = client.post(
        "/api/doctors",
        headers=staff_headers,
        json={"fullName": "Dr. Pagination Test", "departmentId": dept_id, "specialty": "General"},
    ).get_json()["doctor"]["id"]
    client.post(
        f"/api/doctors/{doctor_id}/availability",
        headers=staff_headers,
        json={"weekday": 0, "startTime": "09:00", "endTime": "13:00"},
    )
    return doctor_id


def _next_monday():
    from datetime import date, timedelta

    today = date.today()
    days_ahead = (0 - today.weekday()) % 7
    return today + timedelta(days=days_ahead or 7)


def test_staff_appointment_list_is_paginated(client, staff_headers, auth_headers):
    from datetime import datetime

    doctor_id = _make_doctor_with_monday_availability(client, staff_headers)
    monday = _next_monday()

    for hour in (9, 10, 11):
        client.post(
            "/api/appointments",
            headers=auth_headers,
            json={
                "doctorId": doctor_id,
                "scheduledStart": datetime.combine(monday, datetime.min.time()).replace(hour=hour).isoformat(),
                "durationMinutes": 30,
            },
        )

    resp = client.get("/api/appointments?perPage=2", headers=staff_headers)
    data = resp.get_json()
    assert len(data["appointments"]) == 2
    assert data["total"] == 3
    assert data["hasMore"] is True


def test_patient_own_appointment_list_is_not_paginated(client, auth_headers):
    """The patient-facing branch of the same endpoint is intentionally left
    unpaginated — see appointments/routes.py's comment — so it must not
    carry pagination metadata at all."""
    resp = client.get("/api/appointments", headers=auth_headers)
    data = resp.get_json()
    assert "page" not in data
    assert "hasMore" not in data


def test_list_conversations_is_paginated(client, auth_headers):
    for _ in range(3):
        client.post("/api/chat/conversations", headers=auth_headers, json={})

    resp = client.get("/api/chat/conversations?perPage=2", headers=auth_headers)
    data = resp.get_json()
    assert len(data["conversations"]) == 2
    assert data["total"] == 3
    assert data["hasMore"] is True
