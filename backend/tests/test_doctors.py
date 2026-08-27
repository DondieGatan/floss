import pytest


@pytest.fixture()
def department_id(client, staff_headers):
    resp = client.post("/api/departments", headers=staff_headers, json={"name": "Cardiology"})
    return resp.get_json()["department"]["id"]


def _doctor_payload(department_id, **overrides):
    payload = {
        "fullName": "Dr. Jane Smith",
        "departmentId": department_id,
        "specialty": "Interventional Cardiology",
        "bio": "20 years of experience.",
    }
    payload.update(overrides)
    return payload


def test_patient_cannot_create_doctor(client, auth_headers, department_id):
    resp = client.post("/api/doctors", headers=auth_headers, json=_doctor_payload(department_id))
    assert resp.status_code == 403


def test_staff_can_create_doctor(client, staff_headers, department_id):
    resp = client.post("/api/doctors", headers=staff_headers, json=_doctor_payload(department_id))
    assert resp.status_code == 201
    data = resp.get_json()["doctor"]
    assert data["fullName"] == "Dr. Jane Smith"
    assert data["departmentName"] == "Cardiology"
    assert data["isActive"] is True
    assert data["availability"] == []


def test_create_doctor_with_photo_url(client, staff_headers, department_id):
    resp = client.post(
        "/api/doctors",
        headers=staff_headers,
        json=_doctor_payload(department_id, photoUrl="https://example.com/jane.jpg"),
    )
    assert resp.status_code == 201
    assert resp.get_json()["doctor"]["photoUrl"] == "https://example.com/jane.jpg"


def test_create_doctor_without_photo_url_defaults_to_none(client, staff_headers, department_id):
    resp = client.post("/api/doctors", headers=staff_headers, json=_doctor_payload(department_id))
    assert resp.status_code == 201
    assert resp.get_json()["doctor"]["photoUrl"] is None


def test_staff_can_update_doctor(client, staff_headers, department_id):
    doctor_id = client.post(
        "/api/doctors", headers=staff_headers, json=_doctor_payload(department_id)
    ).get_json()["doctor"]["id"]

    resp = client.put(
        f"/api/doctors/{doctor_id}",
        headers=staff_headers,
        json=_doctor_payload(department_id, fullName="Dr. Jane Renamed", photoUrl="https://example.com/new.jpg"),
    )
    assert resp.status_code == 200
    data = resp.get_json()["doctor"]
    assert data["fullName"] == "Dr. Jane Renamed"
    assert data["photoUrl"] == "https://example.com/new.jpg"


def test_patient_cannot_update_doctor(client, auth_headers, staff_headers, department_id):
    doctor_id = client.post(
        "/api/doctors", headers=staff_headers, json=_doctor_payload(department_id)
    ).get_json()["doctor"]["id"]

    resp = client.put(f"/api/doctors/{doctor_id}", headers=auth_headers, json=_doctor_payload(department_id))
    assert resp.status_code == 403


def test_update_missing_doctor_returns_404(client, staff_headers, department_id):
    resp = client.put(
        "/api/doctors/999999", headers=staff_headers, json=_doctor_payload(department_id)
    )
    assert resp.status_code == 404


def test_update_doctor_requires_valid_department(client, staff_headers, department_id):
    doctor_id = client.post(
        "/api/doctors", headers=staff_headers, json=_doctor_payload(department_id)
    ).get_json()["doctor"]["id"]

    resp = client.put(
        f"/api/doctors/{doctor_id}", headers=staff_headers, json=_doctor_payload(department_id=999999)
    )
    assert resp.status_code == 400


def test_create_doctor_requires_valid_department(client, staff_headers):
    resp = client.post("/api/doctors", headers=staff_headers, json=_doctor_payload(department_id=999999))
    assert resp.status_code == 400


def test_list_doctors_filters_by_department(client, staff_headers, department_id):
    other_dept = client.post(
        "/api/departments", headers=staff_headers, json={"name": "Neurology"}
    ).get_json()["department"]["id"]
    client.post("/api/doctors", headers=staff_headers, json=_doctor_payload(department_id))
    client.post(
        "/api/doctors", headers=staff_headers,
        json=_doctor_payload(other_dept, fullName="Dr. Neuro", specialty="Neurology"),
    )

    resp = client.get(f"/api/doctors?departmentId={department_id}", headers=staff_headers)
    doctors = resp.get_json()["doctors"]
    assert len(doctors) == 1
    assert doctors[0]["fullName"] == "Dr. Jane Smith"


def test_delete_doctor_soft_deactivates(client, staff_headers, department_id):
    doctor_id = client.post(
        "/api/doctors", headers=staff_headers, json=_doctor_payload(department_id)
    ).get_json()["doctor"]["id"]

    resp = client.delete(f"/api/doctors/{doctor_id}", headers=staff_headers)
    assert resp.status_code == 204

    # Soft-deleted doctors are excluded from the default list...
    resp = client.get("/api/doctors", headers=staff_headers)
    assert resp.get_json()["doctors"] == []
    # ...but the row itself still exists and is directly fetchable.
    resp = client.get(f"/api/doctors/{doctor_id}", headers=staff_headers)
    assert resp.status_code == 200
    assert resp.get_json()["doctor"]["isActive"] is False


def test_add_availability_requires_staff(client, auth_headers, staff_headers, department_id):
    doctor_id = client.post(
        "/api/doctors", headers=staff_headers, json=_doctor_payload(department_id)
    ).get_json()["doctor"]["id"]

    resp = client.post(
        f"/api/doctors/{doctor_id}/availability",
        headers=auth_headers,
        json={"weekday": 0, "startTime": "09:00", "endTime": "13:00"},
    )
    assert resp.status_code == 403


def test_add_and_delete_availability(client, staff_headers, department_id):
    doctor_id = client.post(
        "/api/doctors", headers=staff_headers, json=_doctor_payload(department_id)
    ).get_json()["doctor"]["id"]

    resp = client.post(
        f"/api/doctors/{doctor_id}/availability",
        headers=staff_headers,
        json={"weekday": 0, "startTime": "09:00", "endTime": "13:00"},
    )
    assert resp.status_code == 201
    availability = resp.get_json()["availability"]
    assert availability == {"id": availability["id"], "weekday": 0, "startTime": "09:00", "endTime": "13:00"}

    resp = client.get(f"/api/doctors/{doctor_id}", headers=staff_headers)
    assert len(resp.get_json()["doctor"]["availability"]) == 1

    resp = client.delete(
        f"/api/doctors/{doctor_id}/availability/{availability['id']}", headers=staff_headers
    )
    assert resp.status_code == 204

    resp = client.get(f"/api/doctors/{doctor_id}", headers=staff_headers)
    assert resp.get_json()["doctor"]["availability"] == []


def test_add_availability_rejects_start_after_end(client, staff_headers, department_id):
    doctor_id = client.post(
        "/api/doctors", headers=staff_headers, json=_doctor_payload(department_id)
    ).get_json()["doctor"]["id"]

    resp = client.post(
        f"/api/doctors/{doctor_id}/availability",
        headers=staff_headers,
        json={"weekday": 0, "startTime": "13:00", "endTime": "09:00"},
    )
    assert resp.status_code == 400


def test_add_availability_rejects_invalid_weekday(client, staff_headers, department_id):
    doctor_id = client.post(
        "/api/doctors", headers=staff_headers, json=_doctor_payload(department_id)
    ).get_json()["doctor"]["id"]

    resp = client.post(
        f"/api/doctors/{doctor_id}/availability",
        headers=staff_headers,
        json={"weekday": 7, "startTime": "09:00", "endTime": "13:00"},
    )
    assert resp.status_code == 400
