import pytest

from app.extensions import db as _db
from app.models import Admission, Bed


@pytest.fixture()
def ward_id(client, staff_headers):
    resp = client.post(
        "/api/wards", headers=staff_headers, json={"name": "ICU", "wardType": "Intensive Care", "floor": "3"}
    )
    return resp.get_json()["ward"]["id"]


@pytest.fixture()
def bed_id(client, staff_headers, ward_id):
    resp = client.post(f"/api/wards/{ward_id}/beds", headers=staff_headers, json={"bedNumber": "A1"})
    return resp.get_json()["bed"]["id"]


@pytest.fixture()
def patient_id_of(client):
    def _patient_id(headers):
        resp = client.get("/api/patients/me", headers=headers)
        return resp.get_json()["patient"]["id"]

    return _patient_id


def test_patient_cannot_create_ward(client, auth_headers):
    resp = client.post("/api/wards", headers=auth_headers, json={"name": "ICU", "wardType": "Intensive Care"})
    assert resp.status_code == 403


def test_staff_can_create_ward_and_bed(client, staff_headers, ward_id):
    resp = client.post(f"/api/wards/{ward_id}/beds", headers=staff_headers, json={"bedNumber": "A1"})
    assert resp.status_code == 201
    bed = resp.get_json()["bed"]
    assert bed["bedNumber"] == "A1"
    assert bed["wardName"] == "ICU"
    assert bed["status"] == "available"


def test_create_bed_rejects_duplicate_number_in_same_ward(client, staff_headers, ward_id):
    client.post(f"/api/wards/{ward_id}/beds", headers=staff_headers, json={"bedNumber": "A1"})
    resp = client.post(f"/api/wards/{ward_id}/beds", headers=staff_headers, json={"bedNumber": "A1"})
    assert resp.status_code == 400


def test_patient_cannot_list_admissions(client, auth_headers):
    resp = client.get("/api/admissions", headers=auth_headers)
    assert resp.status_code == 403


def test_create_admission_flips_bed_to_occupied(client, staff_headers, auth_headers, bed_id, patient_id_of):
    patient_id = patient_id_of(auth_headers)

    resp = client.post(
        "/api/admissions", headers=staff_headers, json={"patientId": patient_id, "bedId": bed_id, "reason": "Observation"}
    )
    assert resp.status_code == 201
    admission = resp.get_json()["admission"]
    assert admission["status"] == "active"
    assert admission["bedNumber"] == "A1"
    assert admission["dischargedAt"] is None

    resp = client.get(f"/api/admissions/beds?status=occupied", headers=staff_headers)
    beds = resp.get_json()["beds"]
    assert len(beds) == 1
    assert beds[0]["id"] == bed_id


def test_cannot_admit_to_an_occupied_bed(client, staff_headers, auth_headers, bed_id, patient_id_of):
    patient_id = patient_id_of(auth_headers)
    client.post("/api/admissions", headers=staff_headers, json={"patientId": patient_id, "bedId": bed_id})

    other_patient = client.post(
        "/api/auth/register",
        json={"fullName": "Other Patient", "email": "other@example.com", "password": "password123"},
    ).get_json()
    other_headers = {"Authorization": f"Bearer {other_patient['accessToken']}"}
    other_patient_id = patient_id_of(other_headers)

    resp = client.post(
        "/api/admissions", headers=staff_headers, json={"patientId": other_patient_id, "bedId": bed_id}
    )
    assert resp.status_code == 409


def test_discharge_frees_the_bed_for_readmission(client, staff_headers, auth_headers, bed_id, patient_id_of):
    patient_id = patient_id_of(auth_headers)
    admission_id = client.post(
        "/api/admissions", headers=staff_headers, json={"patientId": patient_id, "bedId": bed_id}
    ).get_json()["admission"]["id"]

    resp = client.patch(f"/api/admissions/{admission_id}/discharge", headers=staff_headers)
    assert resp.status_code == 200
    data = resp.get_json()["admission"]
    assert data["status"] == "discharged"
    assert data["dischargedAt"] is not None

    resp = client.get("/api/admissions/beds?status=available", headers=staff_headers)
    assert any(b["id"] == bed_id for b in resp.get_json()["beds"])

    # The freed bed can be admitted into again.
    resp = client.post("/api/admissions", headers=staff_headers, json={"patientId": patient_id, "bedId": bed_id})
    assert resp.status_code == 201


def test_discharge_already_discharged_admission_returns_400(client, staff_headers, auth_headers, bed_id, patient_id_of):
    patient_id = patient_id_of(auth_headers)
    admission_id = client.post(
        "/api/admissions", headers=staff_headers, json={"patientId": patient_id, "bedId": bed_id}
    ).get_json()["admission"]["id"]

    client.patch(f"/api/admissions/{admission_id}/discharge", headers=staff_headers)
    resp = client.patch(f"/api/admissions/{admission_id}/discharge", headers=staff_headers)
    assert resp.status_code == 400


def test_partial_unique_index_enforces_single_active_admission_per_bed(app, staff_headers, auth_headers, bed_id, patient_id_of):
    """Direct ORM-level check that the DB constraint itself (not just the
    route's pre-check) blocks two active admissions for the same bed."""
    patient_id = patient_id_of(auth_headers)
    with app.app_context():
        first = Admission(patient_id=patient_id, bed_id=bed_id)
        _db.session.add(first)
        _db.session.commit()

        second = Admission(patient_id=patient_id, bed_id=bed_id)
        _db.session.add(second)
        with pytest.raises(Exception):
            _db.session.commit()
        _db.session.rollback()


def test_create_admission_requires_valid_patient_and_bed(client, staff_headers, bed_id):
    resp = client.post("/api/admissions", headers=staff_headers, json={"patientId": 999999, "bedId": bed_id})
    assert resp.status_code == 400

    resp = client.post("/api/admissions", headers=staff_headers, json={"patientId": 1, "bedId": 999999})
    assert resp.status_code == 400
