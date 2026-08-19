from flask import request, jsonify
from flask_jwt_extended import jwt_required

from app.departments import departments_bp
from app.extensions import db
from app.models import Department
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

    db.session.delete(department)
    db.session.commit()
    regenerate_directory_digest(current_user_id())
    return "", 204
