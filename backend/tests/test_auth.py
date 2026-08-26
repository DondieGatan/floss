def test_register_creates_user_and_returns_tokens(client):
    resp = client.post(
        "/api/auth/register",
        json={"fullName": "Alex Kim", "email": "alex@example.com", "password": "password123"},
    )
    assert resp.status_code == 201
    data = resp.get_json()
    assert "accessToken" in data and "refreshToken" in data
    assert data["user"]["email"] == "alex@example.com"
    assert data["user"]["fullName"] == "Alex Kim"


def test_register_rejects_duplicate_email(client, register_user):
    register_user(email="dupe@example.com")
    resp = client.post(
        "/api/auth/register",
        json={"fullName": "Someone Else", "email": "dupe@example.com", "password": "password123"},
    )
    assert resp.status_code == 400


def test_register_rejects_invalid_email(client):
    resp = client.post(
        "/api/auth/register",
        json={"fullName": "Alex Kim", "email": "not-an-email", "password": "password123"},
    )
    assert resp.status_code == 400


def test_register_rejects_short_password(client):
    resp = client.post(
        "/api/auth/register",
        json={"fullName": "Alex Kim", "email": "alex@example.com", "password": "short"},
    )
    assert resp.status_code == 400


def test_login_success(client, register_user):
    register_user(email="alex@example.com", password="password123")
    resp = client.post("/api/auth/login", json={"email": "alex@example.com", "password": "password123"})
    assert resp.status_code == 200
    assert "accessToken" in resp.get_json()


def test_login_wrong_password(client, register_user):
    register_user(email="alex@example.com", password="password123")
    resp = client.post("/api/auth/login", json={"email": "alex@example.com", "password": "wrong"})
    assert resp.status_code == 401


def test_me_requires_auth(client):
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401


def test_me_returns_current_user(client, register_user):
    headers, user_id = register_user(email="alex@example.com")
    resp = client.get("/api/auth/me", headers=headers)
    assert resp.status_code == 200
    assert resp.get_json()["user"]["id"] == user_id


def test_logout_revokes_access_token(client, register_user):
    headers, _user_id = register_user()
    resp = client.post("/api/auth/logout", headers=headers)
    assert resp.status_code == 204

    resp = client.get("/api/auth/me", headers=headers)
    assert resp.status_code == 401


def test_refresh_issues_new_access_token(client):
    resp = client.post(
        "/api/auth/register",
        json={"fullName": "Alex Kim", "email": "alex@example.com", "password": "password123"},
    )
    refresh_token = resp.get_json()["refreshToken"]

    resp = client.post("/api/auth/refresh", headers={"Authorization": f"Bearer {refresh_token}"})
    assert resp.status_code == 200
    assert "accessToken" in resp.get_json()


def test_register_defaults_to_patient_role(client):
    resp = client.post(
        "/api/auth/register",
        json={"fullName": "Alex Kim", "email": "alex@example.com", "password": "password123"},
    )
    assert resp.get_json()["user"]["role"] == "patient"


def test_me_reflects_role(client, register_user):
    headers, _user_id = register_user()
    resp = client.get("/api/auth/me", headers=headers)
    assert resp.get_json()["user"]["role"] == "patient"


def test_forgot_password_generic_response_for_unknown_email(client):
    resp = client.post("/api/auth/forgot-password", json={"email": "nobody@example.com"})
    assert resp.status_code == 200
    data = resp.get_json()
    assert "resetToken" not in data


def test_forgot_password_returns_token_for_known_email(client, register_user):
    register_user(email="alex@example.com")
    resp = client.post("/api/auth/forgot-password", json={"email": "alex@example.com"})
    assert resp.status_code == 200
    # TestConfig runs with TESTING=True, which is the same "not production"
    # gate real debug mode uses — the token is only ever echoed back outside
    # of production, same branch either way.
    assert "resetToken" in resp.get_json()


def test_forgot_password_sends_a_real_email_and_does_not_echo_the_token_when_configured(
    client, register_user, app, monkeypatch
):
    import httpx

    register_user(email="alex@example.com")
    app.config["RESEND_API_KEY"] = "test-key"

    captured = {}

    class _FakeResponse:
        def raise_for_status(self):
            pass

    def _fake_post(url, headers, json, timeout):
        captured["json"] = json
        return _FakeResponse()

    monkeypatch.setattr(httpx, "post", _fake_post)

    resp = client.post("/api/auth/forgot-password", json={"email": "alex@example.com"})

    assert resp.status_code == 200
    # Once a real provider is configured, the token only ever leaves the
    # server inside the email itself — never echoed back in the response,
    # even in testing mode (unlike the not-configured fallback tested
    # above).
    assert "resetToken" not in resp.get_json()
    assert captured["json"]["to"] == ["alex@example.com"]
    assert "reset-password?token=" in captured["json"]["html"]


def test_reset_password_changes_password(client, register_user):
    register_user(email="alex@example.com", password="original123")
    token = client.post(
        "/api/auth/forgot-password", json={"email": "alex@example.com"}
    ).get_json()["resetToken"]

    resp = client.post("/api/auth/reset-password", json={"token": token, "password": "brandnew123"})
    assert resp.status_code == 200

    resp = client.post("/api/auth/login", json={"email": "alex@example.com", "password": "original123"})
    assert resp.status_code == 401

    resp = client.post("/api/auth/login", json={"email": "alex@example.com", "password": "brandnew123"})
    assert resp.status_code == 200


def test_reset_password_token_is_single_use(client, register_user):
    register_user(email="alex@example.com", password="original123")
    token = client.post(
        "/api/auth/forgot-password", json={"email": "alex@example.com"}
    ).get_json()["resetToken"]

    resp = client.post("/api/auth/reset-password", json={"token": token, "password": "brandnew123"})
    assert resp.status_code == 200

    resp = client.post("/api/auth/reset-password", json={"token": token, "password": "anothernew123"})
    assert resp.status_code == 400


def test_reset_password_rejects_garbage_token(client):
    resp = client.post("/api/auth/reset-password", json={"token": "not-a-real-token", "password": "brandnew123"})
    assert resp.status_code == 400


def test_reset_password_rejects_short_password(client, register_user):
    register_user(email="alex@example.com")
    token = client.post(
        "/api/auth/forgot-password", json={"email": "alex@example.com"}
    ).get_json()["resetToken"]

    resp = client.post("/api/auth/reset-password", json={"token": token, "password": "short"})
    assert resp.status_code == 400


def test_refresh_reflects_updated_role(client, register_user, app):
    # Simulates a promotion to staff between token issuance and refresh —
    # the refresh route must re-derive the role from the DB, not copy it
    # off the old refresh token, or a promotion would never take effect.
    from app.extensions import db
    from app.models import User

    headers, user_id = register_user(email="alex@example.com")
    resp = client.post(
        "/api/auth/login", json={"email": "alex@example.com", "password": "password123"}
    )
    refresh_token = resp.get_json()["refreshToken"]

    user = db.session.get(User, user_id)
    user.role = "staff"
    db.session.commit()

    resp = client.post("/api/auth/refresh", headers={"Authorization": f"Bearer {refresh_token}"})
    new_access_token = resp.get_json()["accessToken"]

    me_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {new_access_token}"})
    assert me_resp.get_json()["user"]["role"] == "staff"
