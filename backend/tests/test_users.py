def test_list_users_requires_admin(client, auth_headers, staff_headers, admin_headers):
    resp = client.get("/api/users", headers=auth_headers)
    assert resp.status_code == 403

    resp = client.get("/api/users", headers=staff_headers)
    assert resp.status_code == 403

    resp = client.get("/api/users", headers=admin_headers)
    assert resp.status_code == 200


def test_list_users_excludes_patients(client, admin_headers, register_user):
    # Team & Roles exists to promote/demote staff/admin/owner accounts, not
    # to browse patients — someone joining the clinic gets a staff account
    # directly rather than being promoted from an existing patient login.
    _headers, _patient_id = register_user(email="patient@example.com")

    resp = client.get("/api/users", headers=admin_headers)
    users = resp.get_json()["users"]
    assert "patient" not in {u["role"] for u in users}
    assert "patient@example.com" not in {u["email"] for u in users}


def test_admin_can_grant_and_revoke_staff(client, admin_headers, register_user):
    _headers, patient_id = register_user(email="patient@example.com")

    resp = client.patch(f"/api/users/{patient_id}/role", headers=admin_headers, json={"role": "staff"})
    assert resp.status_code == 200
    assert resp.get_json()["user"]["role"] == "staff"

    resp = client.patch(f"/api/users/{patient_id}/role", headers=admin_headers, json={"role": "patient"})
    assert resp.status_code == 200
    assert resp.get_json()["user"]["role"] == "patient"


def test_admin_cannot_promote_to_admin(client, admin_headers, register_user):
    _headers, patient_id = register_user(email="patient@example.com")
    resp = client.patch(f"/api/users/{patient_id}/role", headers=admin_headers, json={"role": "admin"})
    assert resp.status_code == 403


def test_admin_cannot_touch_an_existing_admin(client, admin_headers, register_staff):
    _headers, other_admin_id = register_staff(email="other-admin@example.com", role="admin")
    resp = client.patch(f"/api/users/{other_admin_id}/role", headers=admin_headers, json={"role": "staff"})
    assert resp.status_code == 403


def test_owner_can_manage_admin_accounts(client, owner_headers, register_staff):
    _headers, admin_id = register_staff(email="admin@example.com", role="admin")

    resp = client.patch(f"/api/users/{admin_id}/role", headers=owner_headers, json={"role": "staff"})
    assert resp.status_code == 200
    assert resp.get_json()["user"]["role"] == "staff"


def test_cannot_change_own_role(client, admin_headers, register_staff):
    # admin_headers belongs to admin@example.com — reuse that same account's
    # id by looking it up via /auth/me rather than a second registration.
    me = client.get("/api/auth/me", headers=admin_headers).get_json()["user"]
    resp = client.patch(f"/api/users/{me['id']}/role", headers=admin_headers, json={"role": "staff"})
    assert resp.status_code == 400


def test_update_role_rejects_invalid_role(client, admin_headers, register_user):
    _headers, patient_id = register_user(email="patient@example.com")
    resp = client.patch(f"/api/users/{patient_id}/role", headers=admin_headers, json={"role": "superuser"})
    assert resp.status_code == 400


def test_role_change_writes_an_audit_log_entry(client, admin_headers, register_user):
    me = client.get("/api/auth/me", headers=admin_headers).get_json()["user"]
    _headers, patient_id = register_user(email="patient@example.com", full_name="Pat Ient")

    client.patch(f"/api/users/{patient_id}/role", headers=admin_headers, json={"role": "staff"})

    resp = client.get("/api/users/audit-log", headers=admin_headers)
    assert resp.status_code == 200
    entries = resp.get_json()["entries"]
    assert len(entries) == 1
    entry = entries[0]
    assert entry["action"] == "role_change"
    assert entry["actorEmail"] == me["email"]
    assert entry["targetEmail"] == "patient@example.com"
    assert entry["details"] == "patient → staff"


def test_audit_log_requires_admin(client, auth_headers, staff_headers):
    resp = client.get("/api/users/audit-log", headers=auth_headers)
    assert resp.status_code == 403

    resp = client.get("/api/users/audit-log", headers=staff_headers)
    assert resp.status_code == 403


def test_audit_log_orders_newest_first(client, admin_headers, register_user):
    _headers, alex_id = register_user(email="alex@example.com")
    _headers2, sam_id = register_user(email="sam@example.com")

    client.patch(f"/api/users/{alex_id}/role", headers=admin_headers, json={"role": "staff"})
    client.patch(f"/api/users/{sam_id}/role", headers=admin_headers, json={"role": "staff"})

    entries = client.get("/api/users/audit-log", headers=admin_headers).get_json()["entries"]
    assert len(entries) == 2
    assert entries[0]["targetEmail"] == "sam@example.com"
    assert entries[1]["targetEmail"] == "alex@example.com"
