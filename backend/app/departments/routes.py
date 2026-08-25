from flask import request, jsonify
from flask_jwt_extended import jwt_required

from app.departments import departments_bp
from app.extensions import db
from app.models import Department, Doctor
from app.utils import current_user_id
from app.auth.decorators import staff_required
from app.documents.digest import regenerate_directory_digest


def _validate(data):
    name = (data.get("name") or "").strip()
    description = (data.get("description") or "").strip() or None
    if not name or len(name) > 120:
        return None, "Name is required and must be 120 characters or fewer."
    return {"name": name, "description": description}, None


@departments_bp.route("", methods=["GET"])
@jwt_required()
def list_departments():
    departments = Department.query.order_by(Department.name).all()
    return jsonify({"departments": [d.to_dict() for d in departments]}), 200


@departments_bp.route("/<int:department_id>", methods=["GET"])
@jwt_required()
def get_department(department_id):
    department = db.session.get(Department, department_id)
    if department is None:
        return jsonify({"error": "Department not found."}), 404
    return jsonify({"department": department.to_dict()}), 200


@departments_bp.route("", methods=["POST"])
@staff_required
def create_department():
    fields, error = _validate(request.get_json(silent=True) or {})
    if error:
        return jsonify({"error": error}), 400
    if Department.query.filter_by(name=fields["name"]).first():
        return jsonify({"error": "A department with this name already exists."}), 400

    department = Department(**fields)
    db.session.add(department)
    db.session.commit()
    regenerate_directory_digest(current_user_id())
    return jsonify({"department": department.to_dict()}), 201


@departments_bp.route("/<int:department_id>", methods=["PUT"])
@staff_required
def update_department(department_id):
    department = db.session.get(Department, department_id)
    if department is None:
        return jsonify({"error": "Department not found."}), 404

    fields, error = _validate(request.get_json(silent=True) or {})
    if error:
        return jsonify({"error": error}), 400

    for key, value in fields.items():
        setattr(department, key, value)
    db.session.commit()
    regenerate_directory_digest(current_user_id())
    return jsonify({"department": department.to_dict()}), 200


@departments_bp.route("/<int:department_id>", methods=["DELETE"])
@staff_required
def delete_department(department_id):
    department = db.session.get(Department, department_id)
    if department is None:
        return jsonify({"error": "Department not found."}), 404

    # Doctor.department_id is a required foreign key (including inactive
    # doctors, who still hold the row) — deleting a department under any of
    # them would break referential integrity, so it's only allowed once it's
    # actually empty. Reassigning/deactivating doctors out of it first is on
    # the caller.
    if Doctor.query.filter_by(department_id=department_id).first() is not None:
        return jsonify({"error": "Reassign or remove its dentists before deleting a department."}), 400

    db.session.delete(department)
    db.session.commit()
    regenerate_directory_digest(current_user_id())
    return "", 204
