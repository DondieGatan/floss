from flask import jsonify

from app.public import public_bp
from app.models import Doctor

# No @jwt_required() anywhere in this file — these are the only doctor
# endpoints meant to be reachable by an anonymous website visitor (the
# landing page's "Meet Our Dentists" flow), so the payload is trimmed to
# what a marketing profile needs and leaves out anything from
# Doctor.to_dict() that isn't: availability schedules, department id,
# is_active.


def _public_doctor_dict(doctor):
    return {
        "id": doctor.id,
        "fullName": doctor.full_name,
        "departmentName": doctor.department.name if doctor.department else None,
        "specialty": doctor.specialty,
        "bio": doctor.bio,
        "photoUrl": doctor.photo_url,
    }


@public_bp.route("/doctors", methods=["GET"])
def list_public_doctors():
    doctors = Doctor.query.filter_by(is_active=True).order_by(Doctor.full_name).all()
    return jsonify({"doctors": [_public_doctor_dict(d) for d in doctors]}), 200


@public_bp.route("/doctors/<int:doctor_id>", methods=["GET"])
def get_public_doctor(doctor_id):
    doctor = Doctor.query.filter_by(id=doctor_id, is_active=True).first()
    if doctor is None:
        return jsonify({"error": "Doctor not found."}), 404
    return jsonify({"doctor": _public_doctor_dict(doctor)}), 200
