from datetime import time

from flask import request, jsonify
from flask_jwt_extended import jwt_required

from app.doctors import doctors_bp
from app.extensions import db, limiter
from app.models import Doctor, Department, DoctorAvailability
from app.utils import current_user_id
from app.auth.decorators import staff_required
from app.documents.digest import regenerate_directory_digest

WEEKDAYS = range(0, 7)


def _parse_time(value):
    try:
        hours, minutes = value.split(":")
        return time(int(hours), int(minutes))
    except (AttributeError, ValueError):
        return None


def _validate_doctor(data):
    full_name = (data.get("fullName") or "").strip()
    specialty = (data.get("specialty") or "").strip()
    department_id = data.get("departmentId")
    bio = (data.get("bio") or "").strip() or None
    photo_url = (data.get("photoUrl") or "").strip() or None

    if not full_name or len(full_name) > 150:
        return None, "Full name is required and must be 150 characters or fewer."
    if not specialty or len(specialty) > 150:
        return None, "Specialty is required."
    if not isinstance(department_id, int) or db.session.get(Department, department_id) is None:
        return None, "A valid department is required."

    return {
        "full_name": full_name,
        "specialty": specialty,
        "department_id": department_id,
        "bio": bio,
        "photo_url": photo_url,
    }, None


@doctors_bp.route("", methods=["GET"])
@jwt_required()
def list_doctors():
    query = Doctor.query.filter_by(is_active=True)
    department_id = request.args.get("departmentId", type=int)
    if department_id:
        query = query.filter_by(department_id=department_id)
    doctors = query.order_by(Doctor.full_name).all()
    return jsonify({"doctors": [d.to_dict(include_availability=True) for d in doctors]}), 200


@doctors_bp.route("/<int:doctor_id>", methods=["GET"])
@jwt_required()
def get_doctor(doctor_id):
    doctor = db.session.get(Doctor, doctor_id)
    if doctor is None:
        return jsonify({"error": "Doctor not found."}), 404
    return jsonify({"doctor": doctor.to_dict(include_availability=True)}), 200


@doctors_bp.route("", methods=["POST"])
@staff_required
@limiter.limit("60 per hour")
def create_doctor():
    fields, error = _validate_doctor(request.get_json(silent=True) or {})
    if error:
        return jsonify({"error": error}), 400

    doctor = Doctor(**fields)
    db.session.add(doctor)
    db.session.commit()
    regenerate_directory_digest(current_user_id())
    return jsonify({"doctor": doctor.to_dict(include_availability=True)}), 201


@doctors_bp.route("/<int:doctor_id>", methods=["PUT"])
@staff_required
@limiter.limit("60 per hour")
def update_doctor(doctor_id):
    doctor = db.session.get(Doctor, doctor_id)
    if doctor is None:
        return jsonify({"error": "Doctor not found."}), 404

    fields, error = _validate_doctor(request.get_json(silent=True) or {})
    if error:
        return jsonify({"error": error}), 400

    for key, value in fields.items():
        setattr(doctor, key, value)
    db.session.commit()
    regenerate_directory_digest(current_user_id())
    return jsonify({"doctor": doctor.to_dict(include_availability=True)}), 200


@doctors_bp.route("/<int:doctor_id>", methods=["DELETE"])
@staff_required
@limiter.limit("60 per hour")
def delete_doctor(doctor_id):
    doctor = db.session.get(Doctor, doctor_id)
    if doctor is None:
        return jsonify({"error": "Doctor not found."}), 404

    # Soft delete — deactivate rather than hard-delete, so existing/past
    # Appointment rows referencing this doctor stay intact.
    doctor.is_active = False
    db.session.commit()
    regenerate_directory_digest(current_user_id())
    return "", 204


@doctors_bp.route("/<int:doctor_id>/availability", methods=["POST"])
@staff_required
@limiter.limit("60 per hour")
def add_availability(doctor_id):
    doctor = db.session.get(Doctor, doctor_id)
    if doctor is None:
        return jsonify({"error": "Doctor not found."}), 404

    data = request.get_json(silent=True) or {}
    weekday = data.get("weekday")
    start_time = _parse_time(data.get("startTime"))
    end_time = _parse_time(data.get("endTime"))

    if not isinstance(weekday, int) or weekday not in WEEKDAYS:
        return jsonify({"error": "weekday must be 0 (Monday) through 6 (Sunday)."}), 400
    if start_time is None or end_time is None:
        return jsonify({"error": "startTime/endTime must be HH:MM."}), 400
    if start_time >= end_time:
        return jsonify({"error": "startTime must be before endTime."}), 400

    availability = DoctorAvailability(
        doctor_id=doctor.id, weekday=weekday, start_time=start_time, end_time=end_time
    )
    db.session.add(availability)
    db.session.commit()
    regenerate_directory_digest(current_user_id())
    return jsonify({"availability": availability.to_dict()}), 201


@doctors_bp.route("/<int:doctor_id>/availability/<int:availability_id>", methods=["DELETE"])
@staff_required
@limiter.limit("60 per hour")
def delete_availability(doctor_id, availability_id):
    availability = DoctorAvailability.query.filter_by(id=availability_id, doctor_id=doctor_id).first()
    if availability is None:
        return jsonify({"error": "Availability window not found."}), 404

    db.session.delete(availability)
    db.session.commit()
    regenerate_directory_digest(current_user_id())
    return "", 204
