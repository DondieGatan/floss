import re
import secrets
from datetime import datetime, timezone

import pyotp
from flask import request, jsonify, current_app
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_jwt,
    get_jwt_identity,
    jwt_required,
)
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from werkzeug.security import generate_password_hash, check_password_hash

from app.auth import auth_bp
from app.extensions import db, limiter
from app.models import User, TokenBlocklist, PatientProfile, RecoveryCode
from app.utils import current_user_id
from app.email import send_email

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
RESET_TOKEN_MAX_AGE_SECONDS = 1800  # 30 minutes
# Covers both 2FA methods: long enough for the TOTP window and for an email
# to actually arrive (which an always-on authenticator app never has to
# wait on) — a single pending token can't carry two different expiries.
TWO_FACTOR_TOKEN_MAX_AGE_SECONDS = 600  # 10 minutes
EMAIL_OTP_SETUP_TOKEN_MAX_AGE_SECONDS = 600  # 10 minutes
# staff/admin/owner carry broad access to every patient's data (the whole
# directory, schedules, chat history), so 2FA is mandatory for them — a
# compromised one of those accounts is a much bigger blast radius than a
# patient's own account, which only ever exposes that one patient's data.
# Enforced here (can't disable) and in app/__init__.py's before_request
# hook (can't use the rest of the app until it's set up); mirrored in the
# frontend as App.jsx's own TWO_FACTOR_REQUIRED_ROLES.
TWO_FACTOR_REQUIRED_ROLES = {"staff", "admin", "owner"}
RECOVERY_CODE_COUNT = 8


def _reset_serializer():
    return URLSafeTimedSerializer(current_app.config["SECRET_KEY"], salt="password-reset")


def _make_reset_token(user):
    # Folds a fingerprint of the current password hash into the signed
    # payload so the token is single-use for free, with no separate "used"
    # flag or table: set_password() always produces a brand new hash, so
    # the fingerprint stops matching the instant this token is redeemed —
    # or if the password is changed any other way in the meantime.
    return _reset_serializer().dumps({"id": user.id, "fp": user.password_hash[-12:]})


def _user_from_reset_token(token):
    try:
        data = _reset_serializer().loads(token, max_age=RESET_TOKEN_MAX_AGE_SECONDS)
    except (BadSignature, SignatureExpired):
        return None
    user = db.session.get(User, data.get("id"))
    if user is None or user.password_hash[-12:] != data.get("fp"):
        return None
    return user


def _tokens_for(user):
    return {
        "accessToken": create_access_token(identity=str(user.id), additional_claims={"role": user.role}),
        "refreshToken": create_refresh_token(identity=str(user.id)),
    }


def _two_factor_serializer():
    return URLSafeTimedSerializer(current_app.config["SECRET_KEY"], salt="2fa-login")


def _email_otp_setup_serializer():
    return URLSafeTimedSerializer(current_app.config["SECRET_KEY"], salt="2fa-email-setup")


def _generate_otp_code():
    return f"{secrets.randbelow(1_000_000):06d}"


def _otp_email_html(code):
    return f"""
    <div style="font-family: -apple-system, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; color: #222;">
      <h2 style="color: #2f6fed;">Floss Clinic</h2>
      <p>Here's your sign-in code. It expires in 10 minutes.</p>
      <p style="text-align: center; margin: 28px 0; font-size: 32px; font-weight: 700; letter-spacing: 8px;
         color: #1c2b2e;">{code}</p>
      <p style="color: #666; font-size: 13px;">
        If you didn't request this, you can safely ignore this email.
      </p>
    </div>
    """


def _make_two_factor_pending_token(user, email_code_hash=None):
    # Deliberately NOT a JWT (create_access_token): a pending-2FA token
    # must never work as a real bearer token on some other @jwt_required()
    # route, which is exactly what would happen if this were minted through
    # flask_jwt_extended — the whole point of the second factor is that
    # password-correct alone isn't enough to get in yet.
    #
    # email_code_hash carries the hash of the one-time code just emailed to
    # the user, right inside the signed/expiring token itself — no separate
    # table or row to store and clean up, the same way RecoveryCode hashes
    # already work. Its mere presence (vs. absence) is also how
    # two_factor_verify_login tells the two 2FA methods apart.
    payload = {"id": user.id}
    if email_code_hash:
        payload["email_code_hash"] = email_code_hash
    return _two_factor_serializer().dumps(payload)


def _load_two_factor_pending(token):
    try:
        return _two_factor_serializer().loads(token, max_age=TWO_FACTOR_TOKEN_MAX_AGE_SECONDS)
    except (BadSignature, SignatureExpired):
        return None


def _generate_recovery_codes(user):
    """Creates a fresh batch of RecoveryCode rows (replacing any existing
    ones for this user) and returns the plaintext codes — the only time
    they're ever available in plaintext, same as a password. Only the hash
    is persisted."""
    RecoveryCode.query.filter_by(user_id=user.id).delete()
    codes = []
    for _ in range(RECOVERY_CODE_COUNT):
        code = "-".join(secrets.token_hex(2) for _ in range(2))  # e.g. "a1b2-c3d4"
        codes.append(code)
        db.session.add(RecoveryCode(user_id=user.id, code_hash=generate_password_hash(code)))
    return codes


def _consume_recovery_code(user, code):
    """Checks `code` against this user's unused recovery codes and marks
    the matching one used (single-use) if found. Returns True/False."""
    unused = RecoveryCode.query.filter_by(user_id=user.id, used_at=None).all()
    for rc in unused:
        if check_password_hash(rc.code_hash, code):
            rc.used_at = datetime.now(timezone.utc)
            return True
    return False


@auth_bp.route("/register", methods=["POST"])
@limiter.limit("5 per minute")
def register():
    data = request.get_json(silent=True) or {}
    full_name = (data.get("fullName") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not full_name:
        return jsonify({"error": "Full name is required."}), 400
    if not email or not EMAIL_RE.match(email):
        return jsonify({"error": "A valid email is required."}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters."}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "An account with this email already exists."}), 400

    user = User(full_name=full_name, email=email)
    user.set_password(password)
    db.session.add(user)
    db.session.flush()  # assigns user.id, needed for the profile FK below

    # Public registration always creates a patient (role defaults to
    # 'patient') — a self-service form must never be able to pick 'staff'
    # or 'admin' for itself, that's a privilege-escalation hole. Staff/admin
    # accounts are provisioned out-of-band (seed script / future admin
    # tooling), never through this endpoint.
    db.session.add(PatientProfile(user_id=user.id))
    db.session.commit()

    return jsonify({**_tokens_for(user), "user": user.to_dict()}), 201


@auth_bp.route("/login", methods=["POST"])
@limiter.limit("5 per minute")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    user = User.query.filter_by(email=email).first()
    if user is None or not user.check_password(password):
        return jsonify({"error": "Invalid email or password."}), 401

    if user.totp_enabled:
        # Password alone isn't enough — hand back a short-lived pending
        # token instead of real session tokens; the client must complete
        # /2fa/verify-login with a code before actually getting in.
        return jsonify({
            "requiresTwoFactor": True,
            "twoFactorMethod": "totp",
            "twoFactorToken": _make_two_factor_pending_token(user),
        }), 200

    if user.email_otp_enabled:
        code = _generate_otp_code()
        sent = send_email(user.email, "Your Floss Clinic sign-in code", _otp_email_html(code))
        token = _make_two_factor_pending_token(user, email_code_hash=generate_password_hash(code))
        response = {"requiresTwoFactor": True, "twoFactorMethod": "email", "twoFactorToken": token}
        # Same convention as forgot_password below: only ever surface the
        # raw code when there's no real provider to have delivered it, and
        # only outside of production even then.
        if not sent and (current_app.debug or current_app.testing):
            response["devCode"] = code
        return jsonify(response), 200

    return jsonify({**_tokens_for(user), "user": user.to_dict()}), 200


@auth_bp.route("/2fa/verify-login", methods=["POST"])
@limiter.limit("10 per minute")
def two_factor_verify_login():
    data = request.get_json(silent=True) or {}
    pending_token = data.get("twoFactorToken") or ""
    code = (data.get("code") or "").strip()

    payload = _load_two_factor_pending(pending_token)
    if payload is None:
        return jsonify({"error": "This sign-in attempt has expired. Please log in again."}), 401
    user = db.session.get(User, payload.get("id"))
    if user is None:
        return jsonify({"error": "This sign-in attempt has expired. Please log in again."}), 401

    email_code_hash = payload.get("email_code_hash")
    if email_code_hash:
        # 2FA was switched away from email in the meantime — treat the
        # pending token as stale rather than let a stray code decide
        # anything (same reasoning as the totp_enabled check below).
        if not user.email_otp_enabled:
            return jsonify({"error": "This sign-in attempt has expired. Please log in again."}), 401
        valid = check_password_hash(email_code_hash, code) or _consume_recovery_code(user, code)
    else:
        if not user.totp_enabled:
            # 2FA was disabled in the ~10 minutes between password check
            # and code entry — treat the pending token as stale rather than
            # let a now-meaningless "code" field decide anything.
            return jsonify({"error": "This sign-in attempt has expired. Please log in again."}), 401
        valid = pyotp.TOTP(user.totp_secret).verify(code, valid_window=1) or _consume_recovery_code(user, code)

    if not valid:
        return jsonify({"error": "Invalid or expired code."}), 401

    db.session.commit()  # persists a consumed recovery code's used_at, if that's what matched
    return jsonify({**_tokens_for(user), "user": user.to_dict()}), 200


@auth_bp.route("/2fa/resend-email-code", methods=["POST"])
@limiter.limit("3 per 5 minutes")
def two_factor_resend_email_code():
    data = request.get_json(silent=True) or {}
    pending_token = data.get("twoFactorToken") or ""

    payload = _load_two_factor_pending(pending_token)
    if payload is None or "email_code_hash" not in payload:
        return jsonify({"error": "This sign-in attempt has expired. Please log in again."}), 401
    user = db.session.get(User, payload.get("id"))
    if user is None or not user.email_otp_enabled:
        return jsonify({"error": "This sign-in attempt has expired. Please log in again."}), 401

    code = _generate_otp_code()
    sent = send_email(user.email, "Your Floss Clinic sign-in code", _otp_email_html(code))
    response = {"twoFactorToken": _make_two_factor_pending_token(user, email_code_hash=generate_password_hash(code))}
    if not sent and (current_app.debug or current_app.testing):
        response["devCode"] = code
    return jsonify(response), 200


@auth_bp.route("/2fa/status", methods=["GET"])
@jwt_required()
def two_factor_status():
    user = db.session.get(User, current_user_id())
    method = None
    if user:
        method = "totp" if user.totp_enabled else ("email" if user.email_otp_enabled else None)
    return jsonify({"enabled": bool(method), "method": method}), 200


@auth_bp.route("/2fa/setup", methods=["POST"])
@jwt_required()
def two_factor_setup():
    user = db.session.get(User, current_user_id())
    if user.totp_enabled or user.email_otp_enabled:
        return jsonify({"error": "Two-factor authentication is already enabled."}), 400

    # A fresh secret every time /setup is called (re-scanning the QR always
    # gets a code that actually works), left un-enabled until /2fa/enable
    # proves the user can generate a valid code with it.
    secret = pyotp.random_base32()
    user.totp_secret = secret
    db.session.commit()

    otpauth_url = pyotp.TOTP(secret).provisioning_uri(name=user.email, issuer_name="Floss Clinic")
    return jsonify({"secret": secret, "otpauthUrl": otpauth_url}), 200


@auth_bp.route("/2fa/enable", methods=["POST"])
@jwt_required()
def two_factor_enable():
    user = db.session.get(User, current_user_id())
    if user.totp_enabled:
        return jsonify({"error": "Two-factor authentication is already enabled."}), 400
    if not user.totp_secret:
        return jsonify({"error": "Start setup first."}), 400

    code = ((request.get_json(silent=True) or {}).get("code") or "").strip()
    if not pyotp.TOTP(user.totp_secret).verify(code, valid_window=1):
        return jsonify({"error": "That code didn't match. Check the time on your device and try again."}), 400

    user.totp_enabled = True
    recovery_codes = _generate_recovery_codes(user)
    db.session.commit()

    return jsonify({"message": "Two-factor authentication is now enabled.", "recoveryCodes": recovery_codes}), 200


@auth_bp.route("/2fa/email/setup", methods=["POST"])
@jwt_required()
def email_otp_setup():
    user = db.session.get(User, current_user_id())
    if user.totp_enabled or user.email_otp_enabled:
        return jsonify({"error": "Two-factor authentication is already enabled."}), 400

    # No persistent secret like TOTP has — the setup token below carries the
    # hash of this one code, and expires with it. Confirming this code
    # proves the account's email is actually reachable, same purpose the
    # QR-code scan serves for the authenticator-app method.
    code = _generate_otp_code()
    sent = send_email(user.email, "Confirm your Floss Clinic sign-in email", _otp_email_html(code))
    setup_token = _email_otp_setup_serializer().dumps({"id": user.id, "code_hash": generate_password_hash(code)})

    response = {"setupToken": setup_token, "email": user.email}
    if not sent and (current_app.debug or current_app.testing):
        response["devCode"] = code
    return jsonify(response), 200


@auth_bp.route("/2fa/email/enable", methods=["POST"])
@jwt_required()
def email_otp_enable():
    user = db.session.get(User, current_user_id())
    if user.totp_enabled or user.email_otp_enabled:
        return jsonify({"error": "Two-factor authentication is already enabled."}), 400

    data = request.get_json(silent=True) or {}
    setup_token = data.get("setupToken") or ""
    code = (data.get("code") or "").strip()

    try:
        payload = _email_otp_setup_serializer().loads(setup_token, max_age=EMAIL_OTP_SETUP_TOKEN_MAX_AGE_SECONDS)
    except (BadSignature, SignatureExpired):
        return jsonify({"error": "This code has expired. Start setup again."}), 400
    if payload.get("id") != user.id or not check_password_hash(payload.get("code_hash", ""), code):
        return jsonify({"error": "That code didn't match. Check your email and try again."}), 400

    user.email_otp_enabled = True
    recovery_codes = _generate_recovery_codes(user)
    db.session.commit()

    return jsonify({"message": "Two-factor authentication is now enabled.", "recoveryCodes": recovery_codes}), 200


@auth_bp.route("/2fa/disable", methods=["POST"])
@jwt_required()
def two_factor_disable():
    user = db.session.get(User, current_user_id())
    if not user.totp_enabled and not user.email_otp_enabled:
        return jsonify({"error": "Two-factor authentication isn't enabled."}), 400
    if user.role in TWO_FACTOR_REQUIRED_ROLES:
        return jsonify({"error": "Two-factor authentication is required for your role and can't be disabled."}), 400

    password = (request.get_json(silent=True) or {}).get("password") or ""
    if not user.check_password(password):
        return jsonify({"error": "Incorrect password."}), 401

    user.totp_enabled = False
    user.totp_secret = None
    user.email_otp_enabled = False
    RecoveryCode.query.filter_by(user_id=user.id).delete()
    db.session.commit()
    return jsonify({"message": "Two-factor authentication is now disabled."}), 200


def _reset_email_html(reset_url):
    return f"""
    <div style="font-family: -apple-system, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; color: #222;">
      <h2 style="color: #2f6fed;">Floss Clinic</h2>
      <p>We received a request to reset your password. This link expires in 30 minutes.</p>
      <p style="text-align: center; margin: 28px 0;">
        <a href="{reset_url}" style="background: #2f6fed; color: #fff; padding: 12px 24px; border-radius: 8px;
           text-decoration: none; font-weight: 600; display: inline-block;">Reset your password</a>
      </p>
      <p style="color: #666; font-size: 13px;">
        If you didn't request this, you can safely ignore this email — your password won't be changed.
      </p>
    </div>
    """


@auth_bp.route("/forgot-password", methods=["POST"])
@limiter.limit("5 per hour")
def forgot_password():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    user = User.query.filter_by(email=email).first() if email else None

    # Same response whether or not the email exists — a different one here
    # would let an attacker enumerate registered accounts.
    response = {"message": "If an account exists for that email, a reset link has been sent."}

    if user is not None:
        token = _make_reset_token(user)
        reset_url = f"{current_app.config['FRONTEND_URL']}/reset-password?token={token}"
        sent = send_email(user.email, "Reset your Floss Clinic password", _reset_email_html(reset_url))
        # Only expose the raw token — via log or in the response itself —
        # when there's no real provider to have actually delivered it, and
        # only outside of production even then. Once email is configured,
        # neither happens: the token only ever leaves the server inside a
        # real email.
        if not sent:
            current_app.logger.info("Password reset requested for %s — token: %s", user.email, token)
            if current_app.debug or current_app.testing:
                response["resetToken"] = token

    return jsonify(response), 200


@auth_bp.route("/reset-password", methods=["POST"])
@limiter.limit("5 per hour")
def reset_password():
    data = request.get_json(silent=True) or {}
    token = data.get("token") or ""
    password = data.get("password") or ""

    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters."}), 400

    user = _user_from_reset_token(token)
    if user is None:
        return jsonify({"error": "This reset link is invalid or has expired."}), 400

    user.set_password(password)
    db.session.commit()
    return jsonify({"message": "Password updated. You can now sign in."}), 200


@auth_bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    identity = get_jwt_identity()
    # Re-derive the role claim from a fresh DB lookup rather than copying it
    # off the refresh token — a role change (e.g. promoted to staff) should
    # take effect on the next refresh cycle, not never.
    user = db.session.get(User, int(identity))
    if user is None:
        return jsonify({"error": "User not found."}), 404
    return jsonify({"accessToken": create_access_token(identity=identity, additional_claims={"role": user.role})}), 200


@auth_bp.route("/logout", methods=["POST"])
@jwt_required()
def logout():
    jti = get_jwt()["jti"]
    db.session.add(TokenBlocklist(jti=jti))

    data = request.get_json(silent=True) or {}
    refresh_token = data.get("refreshToken")
    if refresh_token:
        try:
            payload = decode_token(refresh_token)
            db.session.add(TokenBlocklist(jti=payload["jti"]))
        except Exception:
            pass

    db.session.commit()
    return "", 204


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    user = db.session.get(User, current_user_id())
    if user is None:
        return jsonify({"error": "User not found."}), 404
    return jsonify({"user": user.to_dict()}), 200
