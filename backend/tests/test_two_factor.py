import pyotp


def _setup_and_enable(client, headers):
    """Walks a fresh account through setup -> enable, returns
    (secret, recovery_codes)."""
    setup = client.post("/api/auth/2fa/setup", headers=headers).get_json()
    secret = setup["secret"]
    code = pyotp.TOTP(secret).now()
    enabled = client.post("/api/auth/2fa/enable", headers=headers, json={"code": code}).get_json()
    return secret, enabled["recoveryCodes"]


def test_2fa_setup_requires_auth(client):
    resp = client.post("/api/auth/2fa/setup")
    assert resp.status_code == 401


def test_2fa_setup_returns_secret_and_otpauth_url(client, auth_headers):
    resp = client.post("/api/auth/2fa/setup", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert len(data["secret"]) >= 16
    assert data["otpauthUrl"].startswith("otpauth://totp/")
    assert "Floss%20Clinic" in data["otpauthUrl"] or "Floss+Clinic" in data["otpauthUrl"]


def test_2fa_status_reflects_enabled_state(client, auth_headers):
    assert client.get("/api/auth/2fa/status", headers=auth_headers).get_json()["enabled"] is False
    _setup_and_enable(client, auth_headers)
    assert client.get("/api/auth/2fa/status", headers=auth_headers).get_json()["enabled"] is True


def test_2fa_enable_without_setup_fails(client, auth_headers):
    resp = client.post("/api/auth/2fa/enable", headers=auth_headers, json={"code": "123456"})
    assert resp.status_code == 400


def test_2fa_enable_with_wrong_code_fails(client, auth_headers):
    client.post("/api/auth/2fa/setup", headers=auth_headers)
    resp = client.post("/api/auth/2fa/enable", headers=auth_headers, json={"code": "000000"})
    assert resp.status_code == 400


def test_2fa_enable_with_correct_code_succeeds_and_returns_recovery_codes(client, auth_headers):
    setup = client.post("/api/auth/2fa/setup", headers=auth_headers).get_json()
    code = pyotp.TOTP(setup["secret"]).now()

    resp = client.post("/api/auth/2fa/enable", headers=auth_headers, json={"code": code})
    assert resp.status_code == 200
    codes = resp.get_json()["recoveryCodes"]
    assert len(codes) == 8
    assert len(set(codes)) == 8  # all distinct


def test_login_with_2fa_enabled_does_not_return_tokens_directly(client, register_user):
    headers, _user_id = register_user(email="alex@example.com", password="password123")
    _setup_and_enable(client, headers)

    resp = client.post("/api/auth/login", json={"email": "alex@example.com", "password": "password123"})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["requiresTwoFactor"] is True
    assert "twoFactorToken" in data
    assert "accessToken" not in data


def test_2fa_verify_login_with_correct_code_succeeds(client, register_user):
    headers, _user_id = register_user(email="alex@example.com", password="password123")
    secret, _codes = _setup_and_enable(client, headers)

    login_resp = client.post("/api/auth/login", json={"email": "alex@example.com", "password": "password123"})
    pending_token = login_resp.get_json()["twoFactorToken"]

    resp = client.post(
        "/api/auth/2fa/verify-login",
        json={"twoFactorToken": pending_token, "code": pyotp.TOTP(secret).now()},
    )
    assert resp.status_code == 200
    data = resp.get_json()
    assert "accessToken" in data
    assert data["user"]["email"] == "alex@example.com"


def test_2fa_verify_login_with_wrong_code_fails(client, register_user):
    headers, _user_id = register_user(email="alex@example.com", password="password123")
    _setup_and_enable(client, headers)

    login_resp = client.post("/api/auth/login", json={"email": "alex@example.com", "password": "password123"})
    pending_token = login_resp.get_json()["twoFactorToken"]

    resp = client.post("/api/auth/2fa/verify-login", json={"twoFactorToken": pending_token, "code": "000000"})
    assert resp.status_code == 401


def test_2fa_verify_login_with_garbage_token_fails(client):
    resp = client.post("/api/auth/2fa/verify-login", json={"twoFactorToken": "not-a-real-token", "code": "123456"})
    assert resp.status_code == 401


def test_2fa_verify_login_with_recovery_code_succeeds_and_is_single_use(client, register_user):
    headers, _user_id = register_user(email="alex@example.com", password="password123")
    _secret, codes = _setup_and_enable(client, headers)
    recovery_code = codes[0]

    login_resp = client.post("/api/auth/login", json={"email": "alex@example.com", "password": "password123"})
    pending_token_1 = login_resp.get_json()["twoFactorToken"]
    resp1 = client.post(
        "/api/auth/2fa/verify-login", json={"twoFactorToken": pending_token_1, "code": recovery_code}
    )
    assert resp1.status_code == 200

    # Same code again, fresh login attempt — must be rejected, it's used up.
    login_resp2 = client.post("/api/auth/login", json={"email": "alex@example.com", "password": "password123"})
    pending_token_2 = login_resp2.get_json()["twoFactorToken"]
    resp2 = client.post(
        "/api/auth/2fa/verify-login", json={"twoFactorToken": pending_token_2, "code": recovery_code}
    )
    assert resp2.status_code == 401


def test_2fa_disable_requires_correct_password(client, auth_headers):
    _setup_and_enable(client, auth_headers)

    resp = client.post("/api/auth/2fa/disable", headers=auth_headers, json={"password": "wrong-password"})
    assert resp.status_code == 401
    assert client.get("/api/auth/2fa/status", headers=auth_headers).get_json()["enabled"] is True


def test_2fa_disable_with_correct_password_succeeds(client, register_user):
    headers, _user_id = register_user(email="alex@example.com", password="password123")
    _setup_and_enable(client, headers)

    resp = client.post("/api/auth/2fa/disable", headers=headers, json={"password": "password123"})
    assert resp.status_code == 200
    assert client.get("/api/auth/2fa/status", headers=headers).get_json()["enabled"] is False

    # Login goes straight back to issuing real tokens, no second factor.
    login_resp = client.post("/api/auth/login", json={"email": "alex@example.com", "password": "password123"})
    assert "accessToken" in login_resp.get_json()


def test_2fa_disable_clears_recovery_codes(client, register_user):
    headers, _user_id = register_user(email="alex@example.com", password="password123")
    _secret, codes = _setup_and_enable(client, headers)
    client.post("/api/auth/2fa/disable", headers=headers, json={"password": "password123"})

    # Re-enable fresh and confirm an old recovery code from before the
    # disable/re-enable cycle no longer works.
    _new_secret, new_codes = _setup_and_enable(client, headers)
    assert codes[0] not in new_codes

    login_resp = client.post("/api/auth/login", json={"email": "alex@example.com", "password": "password123"})
    pending_token = login_resp.get_json()["twoFactorToken"]
    resp = client.post("/api/auth/2fa/verify-login", json={"twoFactorToken": pending_token, "code": codes[0]})
    assert resp.status_code == 401
