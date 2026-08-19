"""Populate a fresh dev database with demo data for Floss: a staff and an
admin account, a handful of specialty areas/dentists with weekly
availability, a couple of treatment rooms with chairs, and one sample
patient with an upcoming appointment. Safe to re-run — skips anything that
already exists by name.

Usage: venv/Scripts/python.exe seed.py
"""
from datetime import time

from app import create_app
from app.extensions import db
from app.models import (
    User,
    Department,
    Doctor,
    DoctorAvailability,
    PatientProfile,
    Ward,
    Bed,
)
from app.documents.digest import regenerate_directory_digest

DEPARTMENTS = [
    ("General Dentistry", "Cleanings, fillings, and preventive care."),
    ("Orthodontics", "Braces, aligners, and bite correction."),
    ("Endodontics", "Root canal therapy and pulp care."),
    ("Periodontics", "Gum disease treatment and gum health."),
    ("Oral & Maxillofacial Surgery", "Extractions, wisdom teeth, and jaw surgery."),
    ("Pediatric Dentistry", "Dental care for infants, children, and teens."),
]

DOCTORS = [
    ("Dr. Amara Osei", "General Dentistry", "General & Preventive Dentistry", "15 years helping patients keep healthy smiles."),
    ("Dr. Liam Chen", "Orthodontics", "Braces & Invisalign", "Specialist in bite correction for teens and adults."),
    ("Dr. Priya Nair", "Endodontics", "Root Canal Therapy", "Focused on pain-free root canal treatment."),
    ("Dr. Marcus Webb", "Pediatric Dentistry", "Pediatric Dental Care", "Loves working with kids of all ages."),
    ("Dr. Sofia Torres", "Oral & Maxillofacial Surgery", "Wisdom Tooth Extraction", "Helps patients through extractions and jaw surgery."),
]

# Mon-Fri 9-1 and 2-5 for every seeded dentist — enough to exercise booking.
AVAILABILITY_WINDOWS = [
    (0, time(9, 0), time(13, 0)),
    (0, time(14, 0), time(17, 0)),
    (2, time(9, 0), time(13, 0)),
    (2, time(14, 0), time(17, 0)),
    (4, time(9, 0), time(13, 0)),
]

# Ward/Bed model reused as "treatment room / chair" — same occupancy-tracking
# shape (one active session per chair), different domain label. See
# frontend AdmissionsPage.jsx for the "Treatment Rooms" UI built on this.
ROOMS = [
    ("Room A", "General Treatment", "1", ["Chair 1", "Chair 2", "Chair 3"]),
    ("Room B", "Orthodontics", "1", ["Chair 1", "Chair 2"]),
    ("Surgical Suite", "Oral Surgery", "2", ["Chair 1", "Chair 2"]),
]


def get_or_create_user(email, full_name, password, role):
    user = User.query.filter_by(email=email).first()
    if user:
        return user
    user = User(full_name=full_name, email=email, role=role)
    user.set_password(password)
    db.session.add(user)
    db.session.flush()
    return user


def seed():
    app = create_app()
    with app.app_context():
        staff = get_or_create_user("staff@floss.demo", "Nora Bennett", "password123", "staff")
        admin = get_or_create_user("admin@floss.demo", "Admin Rivera", "password123", "admin")

        dept_by_name = {}
        for name, description in DEPARTMENTS:
            dept = Department.query.filter_by(name=name).first()
            if dept is None:
                dept = Department(name=name, description=description)
                db.session.add(dept)
                db.session.flush()
            dept_by_name[name] = dept

        for full_name, dept_name, specialty, bio in DOCTORS:
            doctor = Doctor.query.filter_by(full_name=full_name).first()
            if doctor is None:
                doctor = Doctor(
                    full_name=full_name,
                    department_id=dept_by_name[dept_name].id,
                    specialty=specialty,
                    bio=bio,
                )
                db.session.add(doctor)
                db.session.flush()
                for weekday, start, end in AVAILABILITY_WINDOWS:
                    db.session.add(DoctorAvailability(doctor_id=doctor.id, weekday=weekday, start_time=start, end_time=end))

        for room_name, room_type, floor, chair_numbers in ROOMS:
            room = Ward.query.filter_by(name=room_name).first()
            if room is None:
                room = Ward(name=room_name, ward_type=room_type, floor=floor)
                db.session.add(room)
                db.session.flush()
                for chair_number in chair_numbers:
                    db.session.add(Bed(ward_id=room.id, bed_number=chair_number))

        patient_user = get_or_create_user("patient@floss.demo", "Jordan Ellis", "password123", "patient")
        if PatientProfile.query.filter_by(user_id=patient_user.id).first() is None:
            db.session.add(PatientProfile(user_id=patient_user.id, phone="555-0100"))

        db.session.commit()
        regenerate_directory_digest(staff.id)

        print("Seeded demo data:")
        print("  staff@floss.demo / password123")
        print("  admin@floss.demo / password123")
        print("  patient@floss.demo / password123")


if __name__ == "__main__":
    seed()
