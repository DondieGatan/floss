def test_registration_creates_patient_profile(client):
    resp = client.post(
        "/api/auth/register",
        json={"fullName": "Alex Kim", "email": "alex@example.com", "password": "password123"},
    )
    headers = {"Authorization": f"Bearer {resp.get_json()['accessToken']}"}

    resp = client.get("/api/patients/me", headers=headers)
    assert resp.status_code == 200
    data = resp.get_json()["patient"]
    assert data["fullName"] == "Alex Kim"
    assert data["email"] == "alex@example.com"
    assert data["dateOfBirth"] is None
    assert data["phone"] is None


def test_get_my_profile_requires_auth(client):
    resp = client.get("/api/patients/me")
    assert resp.status_code == 401


def test_staff_has_no_patient_profile(client, staff_headers):
    resp = client.get("/api/patients/me", headers=staff_headers)
    assert resp.status_code == 404


def test_update_my_profile(client, auth_headers):
    resp = client.put(
        "/api/patients/me",
        headers=auth_headers,
        json={
            "dateOfBirth": "1990-05-20",
            "phone": "555-1234",
            "address": "123 Main St",
            "emergencyContactName": "Sam Kim",
            "emergencyContactPhone": "555-5678",
            "bloodType": "O+",
        },
    )
    assert resp.status_code == 200
    data = resp.get_json()["patient"]
    assert data["dateOfBirth"] == "1990-05-20"
    assert data["phone"] == "555-1234"
    assert data["bloodType"] == "O+"


def test_update_my_profile_partial_update_keeps_other_fields(client, auth_headers):
    client.put("/api/patients/me", headers=auth_headers, json={"phone": "555-1234"})
    resp = client.put("/api/patients/me", headers=auth_headers, json={"bloodType": "A-"})
    data = resp.get_json()["patient"]
    assert data["phone"] == "555-1234"
    assert data["bloodType"] == "A-"


def test_update_my_profile_rejects_invalid_date(client, auth_headers):
    resp = client.put("/api/patients/me", headers=auth_headers, json={"dateOfBirth": "not-a-date"})
    assert resp.status_code == 200
    assert resp.get_json()["patient"]["dateOfBirth"] is None


def test_list_patients_requires_staff(client, auth_headers, staff_headers):
    resp = client.get("/api/patients", headers=auth_headers)
    assert resp.status_code == 403

    resp = client.get("/api/patients", headers=staff_headers)
    assert resp.status_code == 200


def test_staff_can_view_specific_patient(client, auth_headers, staff_headers):
    my_id = client.get("/api/patients/me", headers=auth_headers).get_json()["patient"]["id"]

    resp = client.get(f"/api/patients/{my_id}", headers=staff_headers)
    assert resp.status_code == 200
    assert resp.get_json()["patient"]["id"] == my_id


def test_patient_cannot_view_another_patients_record_via_staff_route(client, register_user):
    # A patient hitting the staff-only detail route at all should be 403,
    # regardless of whose id they pass.
    headers, _user_id = register_user(email="patient@example.com")
    resp = client.get("/api/patients/1", headers=headers)
    assert resp.status_code == 403
