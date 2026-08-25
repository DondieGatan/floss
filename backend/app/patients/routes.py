from datetime import date

from flask import request, jsonify
from flask_jwt_extended import jwt_required

from app.patients import patients_bp
from app.extensions import db
from app.models import PatientProfile, User
from app.utils import current_user_id
from app.auth.decorators import staff_required
from app.pagination import paginate


def _parse_date(value):
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except (TypeError, ValueError):
        return None


def _apply_profile_fields(profile, data):
    if "dateOfBirth" in data:
        profile.date_of_birth = _parse_date(data.get("dateOfBirth"))
    for json_key, column in [
        ("phone", "phone"),
        ("address", "address"),
        ("emergencyContactName", "emergency_contact_name"),
        ("emergencyContactPhone", "emergency_contact_phone"),
        ("bloodType", "blood_type"),
    ]:
        if json_key in data:
            value = (data.get(json_key) or "").strip() or None
            setattr(profile, column, value)


def _profile_with_user(profile):
    return {**profile.to_dict(), "fullName": profile.user.full_name, "email": profile.user.email}


@patients_bp.route("/me", methods=["GET"])
@jwt_required()
def get_my_profile():
    profile = PatientProfile.query.filter_by(user_id=current_user_id()).first()
    if profile is None:
        return jsonify({"error": "No patient profile for this account."}), 404
    return jsonify({"patient": _profile_with_user(profile)}), 200


@patients_bp.route("/me", methods=["PUT"])
@jwt_required()
def update_my_profile():
    profile = PatientProfile.query.filter_by(user_id=current_user_id()).first()
    if profile is None:
        return jsonify({"error": "No patient profile for this account."}), 404

    _apply_profile_fields(profile, request.get_json(silent=True) or {})
    db.session.commit()
    return jsonify({"patient": _profile_with_user(profile)}), 200


@patients_bp.route("", methods=["GET"])
@staff_required
def list_patients():
    query = PatientProfile.query.join(User, PatientProfile.user_id == User.id).order_by(User.full_name)
    profiles, meta = paginate(query)
    return jsonify({"patients": [_profile_with_user(p) for p in profiles], **meta}), 200


@patients_bp.route("/<int:patient_id>", methods=["GET"])
@staff_required
def get_patient(patient_id):
    profile = db.session.get(PatientProfile, patient_id)
    if profile is None:
        return jsonify({"error": "Patient not found."}), 404
    return jsonify({"patient": _profile_with_user(profile)}), 200
