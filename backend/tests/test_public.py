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
        "photoUrl": "https://example.com/jane.jpg",
    }
    payload.update(overrides)
    return payload


def test_list_public_doctors_requires_no_authentication(client, staff_headers, department_id):
    client.post("/api/doctors", headers=staff_headers, json=_doctor_payload(department_id))

    resp = client.get("/api/public/doctors")
    assert resp.status_code == 200
    names = [d["fullName"] for d in resp.get_json()["doctors"]]
    assert "Dr. Jane Smith" in names


def test_public_doctor_payload_excludes_internal_fields(client, staff_headers, department_id):
    client.post("/api/doctors", headers=staff_headers, json=_doctor_payload(department_id))

    doctor = client.get("/api/public/doctors").get_json()["doctors"][0]
    assert set(doctor.keys()) == {"id", "fullName", "departmentName", "specialty", "bio", "photoUrl"}
    assert doctor["departmentName"] == "Cardiology"
    assert doctor["specialty"] == "Interventional Cardiology"
    assert doctor["bio"] == "20 years of experience."
    assert doctor["photoUrl"] == "https://example.com/jane.jpg"


def test_get_public_doctor_requires_no_authentication(client, staff_headers, department_id):
    doctor_id = client.post(
        "/api/doctors", headers=staff_headers, json=_doctor_payload(department_id)
    ).get_json()["doctor"]["id"]

    resp = client.get(f"/api/public/doctors/{doctor_id}")
    assert resp.status_code == 200
    assert resp.get_json()["doctor"]["fullName"] == "Dr. Jane Smith"


def test_get_public_doctor_404_for_unknown_id(client):
    resp = client.get("/api/public/doctors/999999")
    assert resp.status_code == 404


def test_deactivated_doctor_is_hidden_from_public_endpoints(client, staff_headers, department_id):
    doctor_id = client.post(
        "/api/doctors", headers=staff_headers, json=_doctor_payload(department_id)
    ).get_json()["doctor"]["id"]

    client.delete(f"/api/doctors/{doctor_id}", headers=staff_headers)

    list_resp = client.get("/api/public/doctors")
    assert doctor_id not in [d["id"] for d in list_resp.get_json()["doctors"]]

    get_resp = client.get(f"/api/public/doctors/{doctor_id}")
    assert get_resp.status_code == 404
