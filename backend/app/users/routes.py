from flask import jsonify, request
from flask_jwt_extended import get_jwt

from app.users import users_bp
from app.extensions import db
from app.models import User
from app.utils import current_user_id
from app.auth.decorators import admin_required

ASSIGNABLE_ROLES = {"patient", "staff", "admin", "owner"}
SENSITIVE_ROLES = {"admin", "owner"}


@users_bp.route("", methods=["GET"])
@admin_required
def list_users():
    users = User.query.order_by(User.full_name).all()
    return jsonify({"users": [u.to_dict() for u in users]}), 200


@users_bp.route("/<int:user_id>/role", methods=["PATCH"])
@admin_required
def update_role(user_id):
    if user_id == current_user_id():
        return jsonify({"error": "You can't change your own role."}), 400

    target = db.session.get(User, user_id)
    if target is None:
        return jsonify({"error": "User not found."}), 404

    new_role = (request.get_json(silent=True) or {}).get("role")
    if new_role not in ASSIGNABLE_ROLES:
        return jsonify({"error": "Not a valid role."}), 400

    # A regular admin can grant/revoke staff, but promoting to admin/owner
    # or touching an existing admin/owner account is owner-only — admins
    # managing other admins is exactly what the owner tier exists to gate.
    acting_role = get_jwt().get("role")
    if acting_role != "owner" and (target.role in SENSITIVE_ROLES or new_role in SENSITIVE_ROLES):
        return jsonify({"error": "Only an owner can manage admin accounts."}), 403

    target.role = new_role
    db.session.commit()
    return jsonify({"user": target.to_dict()}), 200
