import re

from flask import request, jsonify
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_jwt,
    get_jwt_identity,
    jwt_required,
)

from app.auth import auth_bp
from app.extensions import db, limiter
from app.models import User, TokenBlocklist, PatientProfile
from app.utils import current_user_id

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _tokens_for(user):
    return {
        "accessToken": create_access_token(identity=str(user.id), additional_claims={"role": user.role}),
        "refreshToken": create_refresh_token(identity=str(user.id)),
    }


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

    return jsonify({**_tokens_for(user), "user": user.to_dict()}), 200


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
