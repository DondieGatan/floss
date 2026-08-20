from datetime import datetime, date, timedelta, timezone

from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt

from app.appointments import appointments_bp
from app.extensions import db, limiter
from app.models import Appointment, Doctor, PatientProfile
from app.utils import current_user_id
from app.appointments.conflicts import (
    check_availability,
    check_no_overlap,
    compute_open_slots,
    AvailabilityError,
    ConflictError,
)

DEFAULT_DURATION_MINUTES = 30
MAX_DURATION_MINUTES = 240


def _is_staff():
    return get_jwt().get("role") in ("staff", "admin")


def _current_patient_profile():
    return PatientProfile.query.filter_by(user_id=current_user_id()).first()


@appointments_bp.route("/availability", methods=["GET"])
@jwt_required()
def get_availability():
    doctor_id = request.args.get("doctorId", type=int)
    date_raw = request.args.get("date")
    duration_minutes = request.args.get("durationMinutes", DEFAULT_DURATION_MINUTES, type=int)

    doctor = db.session.get(Doctor, doctor_id) if doctor_id else None
    if doctor is None:
        return jsonify({"error": "A valid doctorId is required."}), 400
    try:
        requested_date = date.fromisoformat(date_raw)
    except (TypeError, ValueError):
        return jsonify({"error": "date must be YYYY-MM-DD."}), 400
    if requested_date < date.today():
        return jsonify({"slots": []}), 200

    slots = compute_open_slots(doctor.id, requested_date, duration_minutes)
    return jsonify({"slots": [s.isoformat() for s in slots]}), 200


@appointments_bp.route("", methods=["POST"])
@jwt_required()
@limiter.limit("60 per hour")
def create_appointment():
    data = request.get_json(silent=True) or {}
    doctor_id = data.get("doctorId")
    scheduled_start_raw = data.get("scheduledStart")
    duration_minutes = data.get("durationMinutes", DEFAULT_DURATION_MINUTES)
    reason = (data.get("reason") or "").strip() or None

    doctor = db.session.get(Doctor, doctor_id) if isinstance(doctor_id, int) else None
    if doctor is None or not doctor.is_active:
        return jsonify({"error": "A valid doctor is required."}), 400

    try:
        scheduled_start = datetime.fromisoformat(scheduled_start_raw)
    except (TypeError, ValueError):
        return jsonify({"error": "scheduledStart must be an ISO datetime."}), 400

    if not isinstance(duration_minutes, int) or not (0 < duration_minutes <= MAX_DURATION_MINUTES):
        return jsonify({"error": f"durationMinutes must be a positive integer up to {MAX_DURATION_MINUTES}."}), 400

    if _is_staff():
        patient_id = data.get("patientId")
        patient = db.session.get(PatientProfile, patient_id) if isinstance(patient_id, int) else None
        if patient is None:
            return jsonify({"error": "A valid patientId is required."}), 400
    else:
        patient = _current_patient_profile()
        if patient is None:
            return jsonify({"error": "No patient profile for this account."}), 404

    scheduled_end = scheduled_start + timedelta(minutes=duration_minutes)

    # Concurrency note: this check-then-insert is not fully race-proof — a
    # forced "BEGIN IMMEDIATE" transaction was tried here to close that gap
    # and reverted (see app/extensions.py) because it broke ordinary
    # SQLAlchemy schema operations app-wide, a worse trade than the race it
    # closed. What's actually enforced: the partial unique index on
    # (doctor_id, scheduled_start) in app/models.py:Appointment catches the
    # realistic case (double-submit / same-instant double-booking) at the
    # DB level regardless of any race. The narrower gap — two concurrent
    # requests booking *different*, overlapping start times for the same
    # doctor at the same instant — remains theoretically possible and is an
    # accepted limitation at this app's demo/portfolio scale, not a
    # silently-missing feature.
    try:
        check_availability(doctor.id, scheduled_start, scheduled_end)
        check_no_overlap(doctor.id, scheduled_start, scheduled_end)
    except AvailabilityError as exc:
        db.session.rollback()
        return jsonify({"error": str(exc)}), 422
    except ConflictError as exc:
        db.session.rollback()
        return jsonify({"error": str(exc)}), 409

    appointment = Appointment(
        patient_id=patient.id,
        doctor_id=doctor.id,
        scheduled_start=scheduled_start,
        scheduled_end=scheduled_end,
        reason=reason,
    )
    db.session.add(appointment)
    db.session.commit()
    return jsonify({"appointment": appointment.to_dict()}), 201


@appointments_bp.route("", methods=["GET"])
@jwt_required()
def list_appointments():
    if _is_staff():
        query = Appointment.query
        doctor_id = request.args.get("doctorId", type=int)
        if doctor_id:
            query = query.filter_by(doctor_id=doctor_id)
        date_raw = request.args.get("date")
        if date_raw:
            try:
                day = date.fromisoformat(date_raw)
            except ValueError:
                return jsonify({"error": "date must be YYYY-MM-DD."}), 400
            day_start = datetime.combine(day, datetime.min.time())
            query = query.filter(
                Appointment.scheduled_start >= day_start, Appointment.scheduled_start < day_start + timedelta(days=1)
            )
    else:
        patient = _current_patient_profile()
        if patient is None:
            return jsonify({"appointments": []}), 200
        query = Appointment.query.filter_by(patient_id=patient.id)

    appointments = query.order_by(Appointment.scheduled_start.desc()).all()
    return jsonify({"appointments": [a.to_dict() for a in appointments]}), 200


def _get_owned_or_staff_appointment(appointment_id):
    """Mirrors the app's existing dual pattern: staff bypass ownership
    entirely (get_or_404-style), patients get the 404-not-403 ownership
    idiom used everywhere else for owned resources."""
    if _is_staff():
        return db.session.get(Appointment, appointment_id)
    patient = _current_patient_profile()
    if patient is None:
        return None
    return Appointment.query.filter_by(id=appointment_id, patient_id=patient.id).first()


@appointments_bp.route("/<int:appointment_id>", methods=["GET"])
@jwt_required()
def get_appointment(appointment_id):
    appointment = _get_owned_or_staff_appointment(appointment_id)
    if appointment is None:
        return jsonify({"error": "Appointment not found."}), 404
    return jsonify({"appointment": appointment.to_dict()}), 200


@appointments_bp.route("/<int:appointment_id>/cancel", methods=["PATCH"])
@jwt_required()
def cancel_appointment(appointment_id):
    appointment = _get_owned_or_staff_appointment(appointment_id)
    if appointment is None:
        return jsonify({"error": "Appointment not found."}), 404
    if appointment.status == "cancelled":
        return jsonify({"error": "This appointment is already cancelled."}), 400

    data = request.get_json(silent=True) or {}
    appointment.status = "cancelled"
    appointment.cancelled_at = datetime.now(timezone.utc)
    appointment.cancellation_reason = (data.get("cancellationReason") or "").strip() or None
    db.session.commit()
    return jsonify({"appointment": appointment.to_dict()}), 200
