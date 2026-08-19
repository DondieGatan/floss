def test_list_departments_empty(client, auth_headers):
    resp = client.get("/api/departments", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.get_json()["departments"] == []


def test_list_departments_requires_auth(client):
    resp = client.get("/api/departments")
    assert resp.status_code == 401


def test_patient_cannot_create_department(client, auth_headers):
    resp = client.post("/api/departments", headers=auth_headers, json={"name": "Cardiology"})
    assert resp.status_code == 403


def test_staff_can_create_department(client, staff_headers):
    resp = client.post(
        "/api/departments", headers=staff_headers, json={"name": "Cardiology", "description": "Heart care"}
    )
    assert resp.status_code == 201
    data = resp.get_json()["department"]
    assert data["name"] == "Cardiology"
    assert data["description"] == "Heart care"


def test_create_department_rejects_duplicate_name(client, staff_headers):
    client.post("/api/departments", headers=staff_headers, json={"name": "Cardiology"})
    resp = client.post("/api/departments", headers=staff_headers, json={"name": "Cardiology"})
    assert resp.status_code == 400


def test_create_department_requires_name(client, staff_headers):
    resp = client.post("/api/departments", headers=staff_headers, json={"name": ""})
    assert resp.status_code == 400


def test_any_authenticated_user_can_read_department(client, staff_headers, auth_headers):
    dept_id = client.post(
        "/api/departments", headers=staff_headers, json={"name": "Cardiology"}
    ).get_json()["department"]["id"]

    resp = client.get(f"/api/departments/{dept_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.get_json()["department"]["name"] == "Cardiology"


def test_update_department_requires_staff(client, staff_headers, auth_headers):
    dept_id = client.post(
        "/api/departments", headers=staff_headers, json={"name": "Cardiology"}
    ).get_json()["department"]["id"]

    resp = client.put(f"/api/departments/{dept_id}", headers=auth_headers, json={"name": "Renamed"})
    assert resp.status_code == 403

    resp = client.put(f"/api/departments/{dept_id}", headers=staff_headers, json={"name": "Renamed"})
    assert resp.status_code == 200
    assert resp.get_json()["department"]["name"] == "Renamed"


def test_delete_department_requires_staff(client, staff_headers, auth_headers):
    dept_id = client.post(
        "/api/departments", headers=staff_headers, json={"name": "Cardiology"}
    ).get_json()["department"]["id"]

    resp = client.delete(f"/api/departments/{dept_id}", headers=auth_headers)
    assert resp.status_code == 403

    resp = client.delete(f"/api/departments/{dept_id}", headers=staff_headers)
    assert resp.status_code == 204
