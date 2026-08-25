from datetime import datetime, timezone

from flask import request, jsonify

from app.admissions import admissions_bp, wards_bp
from app.extensions import db, limiter
from app.models import Admission, Bed, Doctor, PatientProfile, Ward
from app.auth.decorators import staff_required

# No patient-facing surface here by design: admissions/beds are an internal
# operations view, not something a patient looks up about themselves.


def _validate_ward(data):
    name = (data.get("name") or "").strip()
    ward_type = (data.get("wardType") or "").strip()
    floor = (data.get("floor") or "").strip() or None
    if not name or len(name) > 120:
        return None, "Name is required and must be 120 characters or fewer."
    if not ward_type or len(ward_type) > 100:
        return None, "wardType is required."
    return {"name": name, "ward_type": ward_type, "floor": floor}, None


@wards_bp.route("", methods=["GET"])
@staff_required
def list_wards():
    wards = Ward.query.order_by(Ward.name).all()
    return jsonify({"wards": [w.to_dict() for w in wards]}), 200


@wards_bp.route("", methods=["POST"])
@staff_required
@limiter.limit("60 per hour")
def create_ward():
    fields, error = _validate_ward(request.get_json(silent=True) or {})
    if error:
        return jsonify({"error": error}), 400
    if Ward.query.filter_by(name=fields["name"]).first():
        return jsonify({"error": "A ward with this name already exists."}), 400

    ward = Ward(**fields)
    db.session.add(ward)
    db.session.commit()
    return jsonify({"ward": ward.to_dict()}), 201


@wards_bp.route("/<int:ward_id>/beds", methods=["GET"])
@staff_required
def list_beds(ward_id):
    ward = db.session.get(Ward, ward_id)
    if ward is None:
        return jsonify({"error": "Ward not found."}), 404
    beds = Bed.query.filter_by(ward_id=ward_id).order_by(Bed.bed_number).all()
    return jsonify({"beds": [b.to_dict() for b in beds]}), 200


@wards_bp.route("/<int:ward_id>/beds", methods=["POST"])
@staff_required
@limiter.limit("60 per hour")
def create_bed(ward_id):
    ward = db.session.get(Ward, ward_id)
    if ward is None:
        return jsonify({"error": "Ward not found."}), 404

    bed_number = ((request.get_json(silent=True) or {}).get("bedNumber") or "").strip()
    if not bed_number or len(bed_number) > 20:
        return jsonify({"error": "bedNumber is required and must be 20 characters or fewer."}), 400
    if Bed.query.filter_by(ward_id=ward_id, bed_number=bed_number).first():
        return jsonify({"error": "A bed with this number already exists in this ward."}), 400

    bed = Bed(ward_id=ward_id, bed_number=bed_number)
    db.session.add(bed)
    db.session.commit()
    return jsonify({"bed": bed.to_dict()}), 201


@admissions_bp.route("/beds", methods=["GET"])
@staff_required
def list_all_beds():
    query = Bed.query
    status = request.args.get("status")
    if status:
        query = query.filter_by(status=status)
    beds = query.order_by(Bed.ward_id, Bed.bed_number).all()
    return jsonify({"beds": [b.to_dict() for b in beds]}), 200


@admissions_bp.route("", methods=["GET"])
@staff_required
def list_admissions():
    query = Admission.query
    status = request.args.get("status")
    if status:
        query = query.filter_by(status=status)
    admissions = query.order_by(Admission.admitted_at.desc()).all()
    return jsonify({"admissions": [a.to_dict() for a in admissions]}), 200


@admissions_bp.route("", methods=["POST"])
@staff_required
@limiter.limit("60 per hour")
def create_admission():
    data = request.get_json(silent=True) or {}
    patient_id = data.get("patientId")
    bed_id = data.get("bedId")
    admitting_doctor_id = data.get("admittingDoctorId")
    reason = (data.get("reason") or "").strip() or None

    patient = db.session.get(PatientProfile, patient_id) if isinstance(patient_id, int) else None
    if patient is None:
        return jsonify({"error": "A valid patientId is required."}), 400

    bed = db.session.get(Bed, bed_id) if isinstance(bed_id, int) else None
    if bed is None:
        return jsonify({"error": "A valid bedId is required."}), 400
    if bed.status != "available":
        return jsonify({"error": "This bed is not available."}), 409

    doctor = None
    if admitting_doctor_id is not None:
        doctor = db.session.get(Doctor, admitting_doctor_id) if isinstance(admitting_doctor_id, int) else None
        if doctor is None:
            return jsonify({"error": "admittingDoctorId, if provided, must be valid."}), 400

    # bed.status flip and the Admission insert happen in one commit, so a
    # request that fails partway (e.g. the unique-index check below) leaves
    # neither change applied — the two must never disagree about occupancy.
    admission = Admission(
        patient_id=patient.id,
        bed_id=bed.id,
        admitting_doctor_id=doctor.id if doctor else None,
        reason=reason,
    )
    bed.status = "occupied"
    db.session.add(admission)
    db.session.commit()
    return jsonify({"admission": admission.to_dict()}), 201


@admissions_bp.route("/<int:admission_id>/discharge", methods=["PATCH"])
@staff_required
@limiter.limit("60 per hour")
def discharge_admission(admission_id):
    admission = db.session.get(Admission, admission_id)
    if admission is None:
        return jsonify({"error": "Admission not found."}), 404
    if admission.status == "discharged":
        return jsonify({"error": "This admission is already discharged."}), 400

    admission.status = "discharged"
    admission.discharged_at = datetime.now(timezone.utc)
    admission.bed.status = "available"
    db.session.commit()
    return jsonify({"admission": admission.to_dict()}), 200
