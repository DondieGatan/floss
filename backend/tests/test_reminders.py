from datetime import datetime, timedelta

import pytest

from app.extensions import db
from app.models import Appointment, Department, Doctor, PatientProfile
from app.appointments.reminders import send_due_reminders


@pytest.fixture()
def patient_and_doctor(app, register_user):
    headers, user_id = register_user()
    patient = PatientProfile.query.filter_by(user_id=user_id).first()

    department = Department(name="General Dentistry")
    db.session.add(department)
    db.session.flush()
    doctor = Doctor(full_name="Dr. Amara Osei", department_id=department.id, specialty="General")
    db.session.add(doctor)
    db.session.commit()

    return {"headers": headers, "patient_id": patient.id, "doctor_id": doctor.id}


def _make_appointment(patient_id, doctor_id, start, status="scheduled", reminder_sent_at=None):
    appointment = Appointment(
        patient_id=patient_id,
        doctor_id=doctor_id,
        scheduled_start=start,
        scheduled_end=start + timedelta(minutes=30),
        status=status,
        reminder_sent_at=reminder_sent_at,
    )
    db.session.add(appointment)
    db.session.commit()
    return appointment


def test_sends_reminder_for_appointment_within_the_window(app, patient_and_doctor, caplog):
    appt = _make_appointment(
        patient_and_doctor["patient_id"], patient_and_doctor["doctor_id"], datetime.now() + timedelta(hours=5)
    )

    with caplog.at_level("INFO"):
        due = send_due_reminders()

    assert [a.id for a in due] == [appt.id]
    assert appt.reminder_sent_at is not None
    assert "Appointment reminder" in caplog.text


def test_does_not_remind_appointment_outside_the_window(app, patient_and_doctor):
    appt = _make_appointment(
        patient_and_doctor["patient_id"], patient_and_doctor["doctor_id"], datetime.now() + timedelta(days=5)
    )

    due = send_due_reminders()

    assert due == []
    assert appt.reminder_sent_at is None


def test_does_not_remind_past_appointment(app, patient_and_doctor):
    appt = _make_appointment(
        patient_and_doctor["patient_id"], patient_and_doctor["doctor_id"], datetime.now() - timedelta(hours=1)
    )

    due = send_due_reminders()

    assert due == []
    assert appt.reminder_sent_at is None


def test_does_not_remind_cancelled_appointment(app, patient_and_doctor):
    appt = _make_appointment(
        patient_and_doctor["patient_id"],
        patient_and_doctor["doctor_id"],
        datetime.now() + timedelta(hours=5),
        status="cancelled",
    )

    due = send_due_reminders()

    assert due == []
    assert appt.reminder_sent_at is None


def test_does_not_remind_twice(app, patient_and_doctor):
    already_reminded_at = datetime.now() - timedelta(hours=1)
    appt = _make_appointment(
        patient_and_doctor["patient_id"],
        patient_and_doctor["doctor_id"],
        datetime.now() + timedelta(hours=5),
        reminder_sent_at=already_reminded_at,
    )

    due = send_due_reminders()

    assert due == []
    assert appt.reminder_sent_at == already_reminded_at


def test_reminds_multiple_due_appointments_in_one_pass(app, patient_and_doctor):
    appt_a = _make_appointment(
        patient_and_doctor["patient_id"], patient_and_doctor["doctor_id"], datetime.now() + timedelta(hours=1)
    )
    appt_b = _make_appointment(
        patient_and_doctor["patient_id"], patient_and_doctor["doctor_id"], datetime.now() + timedelta(hours=23)
    )

    due = send_due_reminders()

    assert {a.id for a in due} == {appt_a.id, appt_b.id}
