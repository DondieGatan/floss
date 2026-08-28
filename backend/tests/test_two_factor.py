import pyotp


def _setup_and_enable(client, headers):
    """Walks a fresh account through setup -> enable, returns
    (secret, recovery_codes)."""
    setup = client.post("/api/auth/2fa/setup", headers=headers).get_json()
    secret = setup["secret"]
    code = pyotp.TOTP(secret).now()
    enabled = client.post("/api/auth/2fa/enable", headers=headers, json={"code": code}).get_json()
    return secret, enabled["recoveryCodes"]


def _setup_and_enable_email(client, headers):
    """Same as _setup_and_enable, but for the email OTP method. No email
    provider is configured in tests, so /2fa/email/setup falls back to
    handing the code back directly as devCode (see two_factor_status's
    sibling routes in app/auth/routes.py) — the same convention
    forgot_password already uses."""
    setup = client.post("/api/auth/2fa/email/setup", headers=headers).get_json()
    setup_token = setup["setupToken"]
    code = setup["devCode"]
    enabled = client.post(
        "/api/auth/2fa/email/enable", headers=headers, json={"setupToken": setup_token, "code": code}
    ).get_json()
    return enabled["recoveryCodes"]


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


# --- Email OTP: the alternative to the authenticator-app method above ---


def test_email_otp_setup_requires_auth(client):
    resp = client.post("/api/auth/2fa/email/setup")
    assert resp.status_code == 401


def test_email_otp_setup_returns_a_setup_token_and_dev_code(client, auth_headers):
    resp = client.post("/api/auth/2fa/email/setup", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["setupToken"]
    assert len(data["devCode"]) == 6


def test_email_otp_status_reflects_enabled_state_and_method(client, auth_headers):
    status = client.get("/api/auth/2fa/status", headers=auth_headers).get_json()
    assert status == {"enabled": False, "method": None}

    _setup_and_enable_email(client, auth_headers)

    status = client.get("/api/auth/2fa/status", headers=auth_headers).get_json()
    assert status == {"enabled": True, "method": "email"}


def test_email_otp_enable_with_wrong_code_fails(client, auth_headers):
    client.post("/api/auth/2fa/email/setup", headers=auth_headers)
    resp = client.post(
        "/api/auth/2fa/email/enable", headers=auth_headers, json={"setupToken": "whatever", "code": "000000"}
    )
    assert resp.status_code == 400


def test_email_otp_enable_with_correct_code_succeeds_and_returns_recovery_codes(client, auth_headers):
    setup = client.post("/api/auth/2fa/email/setup", headers=auth_headers).get_json()
    resp = client.post(
        "/api/auth/2fa/email/enable",
        headers=auth_headers,
        json={"setupToken": setup["setupToken"], "code": setup["devCode"]},
    )
    assert resp.status_code == 200
    codes = resp.get_json()["recoveryCodes"]
    assert len(codes) == 8
    assert len(set(codes)) == 8


def test_totp_and_email_otp_are_mutually_exclusive(client, auth_headers):
    _setup_and_enable(client, auth_headers)  # totp now on

    resp = client.post("/api/auth/2fa/email/setup", headers=auth_headers)
    assert resp.status_code == 400

    client.post("/api/auth/2fa/disable", headers=auth_headers, json={"password": "password123"})
    _setup_and_enable_email(client, auth_headers)  # email now on

    resp = client.post("/api/auth/2fa/setup", headers=auth_headers)
    assert resp.status_code == 400


def test_login_with_email_otp_enabled_does_not_return_tokens_directly(client, register_user):
    headers, _user_id = register_user(email="alex@example.com", password="password123")
    _setup_and_enable_email(client, headers)

    resp = client.post("/api/auth/login", json={"email": "alex@example.com", "password": "password123"})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["requiresTwoFactor"] is True
    assert data["twoFactorMethod"] == "email"
    assert "twoFactorToken" in data
    assert "accessToken" not in data
    assert len(data["devCode"]) == 6  # no email provider configured in tests


def test_email_otp_verify_login_with_correct_code_succeeds(client, register_user):
    headers, _user_id = register_user(email="alex@example.com", password="password123")
    _setup_and_enable_email(client, headers)

    login_resp = client.post("/api/auth/login", json={"email": "alex@example.com", "password": "password123"})
    login_data = login_resp.get_json()

    resp = client.post(
        "/api/auth/2fa/verify-login",
        json={"twoFactorToken": login_data["twoFactorToken"], "code": login_data["devCode"]},
    )
    assert resp.status_code == 200
    data = resp.get_json()
    assert "accessToken" in data
    assert data["user"]["email"] == "alex@example.com"


def test_email_otp_verify_login_with_wrong_code_fails(client, register_user):
    headers, _user_id = register_user(email="alex@example.com", password="password123")
    _setup_and_enable_email(client, headers)

    login_resp = client.post("/api/auth/login", json={"email": "alex@example.com", "password": "password123"})
    pending_token = login_resp.get_json()["twoFactorToken"]

    resp = client.post("/api/auth/2fa/verify-login", json={"twoFactorToken": pending_token, "code": "000000"})
    assert resp.status_code == 401


def test_email_otp_verify_login_with_recovery_code_succeeds(client, register_user):
    headers, _user_id = register_user(email="alex@example.com", password="password123")
    codes = _setup_and_enable_email(client, headers)

    login_resp = client.post("/api/auth/login", json={"email": "alex@example.com", "password": "password123"})
    pending_token = login_resp.get_json()["twoFactorToken"]

    resp = client.post("/api/auth/2fa/verify-login", json={"twoFactorToken": pending_token, "code": codes[0]})
    assert resp.status_code == 200
    assert "accessToken" in resp.get_json()


def test_a_totp_code_does_not_work_against_an_email_otp_pending_login(client, register_user):
    """The two pending-token shapes must stay distinct — a code that would
    satisfy the *other* method's check must never accidentally validate."""
    headers, _user_id = register_user(email="alex@example.com", password="password123")
    _setup_and_enable_email(client, headers)

    login_resp = client.post("/api/auth/login", json={"email": "alex@example.com", "password": "password123"})
    pending_token = login_resp.get_json()["twoFactorToken"]

    resp = client.post(
        "/api/auth/2fa/verify-login", json={"twoFactorToken": pending_token, "code": "123456"}
    )
    assert resp.status_code == 401


def test_email_otp_resend_issues_a_working_new_code(client, register_user):
    """The pending token is stateless (the code's hash lives inside the
    signed token itself, not a DB row — see _make_two_factor_pending_token),
    so resending mints an independent token+code pair rather than
    invalidating the original; both stay valid until they individually
    expire. That's fine: each pair still only works together, and each
    still expires and is rate-limited like the first one was."""
    headers, _user_id = register_user(email="alex@example.com", password="password123")
    _setup_and_enable_email(client, headers)

    login_resp = client.post("/api/auth/login", json={"email": "alex@example.com", "password": "password123"})
    login_data = login_resp.get_json()

    resend_resp = client.post("/api/auth/2fa/resend-email-code", json={"twoFactorToken": login_data["twoFactorToken"]})
    assert resend_resp.status_code == 200
    resend_data = resend_resp.get_json()
    assert resend_data["twoFactorToken"] != login_data["twoFactorToken"]
    assert resend_data["devCode"] != login_data["devCode"]

    fresh_resp = client.post(
        "/api/auth/2fa/verify-login",
        json={"twoFactorToken": resend_data["twoFactorToken"], "code": resend_data["devCode"]},
    )
    assert fresh_resp.status_code == 200


def test_email_otp_resend_requires_a_pending_email_login(client):
    resp = client.post("/api/auth/2fa/resend-email-code", json={"twoFactorToken": "not-a-real-token"})
    assert resp.status_code == 401


def test_2fa_disable_clears_email_otp_too(client, register_user):
    headers, _user_id = register_user(email="alex@example.com", password="password123")
    _setup_and_enable_email(client, headers)

    resp = client.post("/api/auth/2fa/disable", headers=headers, json={"password": "password123"})
    assert resp.status_code == 200
    assert client.get("/api/auth/2fa/status", headers=headers).get_json() == {"enabled": False, "method": None}

    login_resp = client.post("/api/auth/login", json={"email": "alex@example.com", "password": "password123"})
    assert "accessToken" in login_resp.get_json()
