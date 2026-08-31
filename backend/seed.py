"""Populate a fresh dev database with demo data for Floss Clinic: 11 staff
accounts and 2 admin accounts (one of each is the primary staff@/admin@
demo login, the rest exist to give staff-scoped pages more than one row
to demonstrate against), a handful of specialty areas/dentists with weekly
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

# Additional staff/admin accounts beyond the primary staff@/admin@ demo
# logins — same password for all, purely so the Team & Roles page and
# staff-scoped features (schedule, directory, treatment rooms) have more
# than one row to demonstrate against.
EXTRA_STAFF = [
    ("staff2@floss.demo", "Emily Carter"),
    ("staff3@floss.demo", "Daniel Brooks"),
    ("staff4@floss.demo", "Sophia Martinez"),
    ("staff5@floss.demo", "Ethan Walsh"),
    ("staff6@floss.demo", "Olivia Kim"),
    ("staff7@floss.demo", "Ryan Fitzgerald"),
    ("staff8@floss.demo", "Ava Thompson"),
    ("staff9@floss.demo", "Nathan Cole"),
    ("staff10@floss.demo", "Isabella Reyes"),
    ("staff11@floss.demo", "Jacob Sullivan"),
]

EXTRA_ADMINS = [
    ("admin2@floss.demo", "Victoria Hale"),
]

DOCTORS = [
    ("Dr. Amara Osei", "General Dentistry", "General & Preventive Dentistry", "Brings 15 years of experience in general and preventive dentistry, with a focus on long-term oral health."),
    ("Dr. Liam Chen", "Orthodontics", "Braces & Invisalign", "Specializes in orthodontic treatment for teens and adults, including traditional braces and Invisalign."),
    ("Dr. Priya Nair", "Endodontics", "Root Canal Therapy", "Focuses on root canal therapy, with particular attention to patient comfort throughout treatment."),
    ("Dr. Marcus Webb", "Pediatric Dentistry", "Pediatric Dental Care", "Provides pediatric dental care tailored to children of all ages, from first visits through adolescence."),
    ("Dr. Sofia Torres", "Oral & Maxillofacial Surgery", "Wisdom Tooth Extraction", "Specializes in oral and maxillofacial surgery, including wisdom tooth extractions and related procedures."),
    ("Dr. Elena Vasquez", "Periodontics", "Gum Disease & Periodontal Care", "Focuses on periodontics and the long-term management of gum health and disease prevention."),
    ("Dr. Noah Bergström", "General Dentistry", "Family & Cosmetic Dentistry", "Provides family and cosmetic dentistry with an emphasis on patient comfort and long-term care."),
    ("Dr. Aisha Rahman", "Orthodontics", "Clear Aligners & Retainers", "Specializes in clear aligner therapy and retainer care for lasting, confident results."),
    ("Dr. Thomas Okafor", "Endodontics", "Microscopic Root Canal Therapy", "Performs microscopic root canal therapy using advanced precision techniques."),
    ("Dr. Grace Lindqvist", "Pediatric Dentistry", "Early Childhood Dental Care", "Specializes in early childhood dentistry, focused on positive, comfortable first experiences."),
]

# Mon-Fri 9-1 and 2-5 for every seeded dentist — enough to exercise booking.
AVAILABILITY_WINDOWS = [
    (0, time(9, 0), time(13, 0)),
    (0, time(14, 0), time(17, 0)),
    (1, time(9, 0), time(13, 0)),
    (1, time(14, 0), time(17, 0)),
    (2, time(9, 0), time(13, 0)),
    (2, time(14, 0), time(17, 0)),
    (3, time(9, 0), time(13, 0)),
    (3, time(14, 0), time(17, 0)),
    (4, time(9, 0), time(13, 0)),
    (4, time(14, 0), time(17, 0)),
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

        for email, full_name in EXTRA_STAFF:
            get_or_create_user(email, full_name, "password123", "staff")
        for email, full_name in EXTRA_ADMINS:
            get_or_create_user(email, full_name, "password123", "admin")

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
            # Checked per-window (not just per-doctor) so re-running this
            # against a database seeded before a AVAILABILITY_WINDOWS change
            # backfills whatever's missing for already-existing doctors too,
            # instead of only ever applying to newly-created ones.
            for weekday, start, end in AVAILABILITY_WINDOWS:
                window = DoctorAvailability.query.filter_by(
                    doctor_id=doctor.id, weekday=weekday, start_time=start, end_time=end
                ).first()
                if window is None:
                    db.session.add(
                        DoctorAvailability(doctor_id=doctor.id, weekday=weekday, start_time=start, end_time=end)
                    )

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
        print("  staff@floss.demo / password123  (+ 10 more staffN@floss.demo)")
        print("  admin@floss.demo / password123  (+ admin2@floss.demo)")
        print("  patient@floss.demo / password123")


if __name__ == "__main__":
    seed()
