from datetime import datetime, timezone

from werkzeug.security import generate_password_hash, check_password_hash

from app.extensions import db


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(150), nullable=False)
    email = db.Column(db.String(255), nullable=False, unique=True, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    # patient | staff | admin | owner — a flat column rather than a Role
    # table: a fixed small set doesn't need dynamic permission assignment,
    # and every other model here is deliberately this minimal too.
    role = db.Column(db.String(20), nullable=False, default="patient", server_default="patient")
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    # Set as soon as 2FA setup starts, but totp_enabled stays False until the
    # user proves they can actually generate a valid code with it — a secret
    # alone (e.g. abandoned mid-setup) must never gate login.
    totp_secret = db.Column(db.String(32), nullable=True)
    totp_enabled = db.Column(db.Boolean, nullable=False, default=False, server_default="0")

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            "id": self.id,
            "fullName": self.full_name,
            "email": self.email,
            "role": self.role,
            "twoFactorEnabled": self.totp_enabled,
        }


class RecoveryCode(db.Model):
    __tablename__ = "recovery_codes"

    # Generated as a batch when 2FA is first enabled, shown to the user
    # exactly once — only the hash is ever persisted, same as a password.
    # Each is single-use (used_at set on redemption) so a code seen once
    # (e.g. leaked via a screenshot) can't be replayed.
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    code_hash = db.Column(db.String(255), nullable=False)
    used_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    user = db.relationship("User")


class TokenBlocklist(db.Model):
    __tablename__ = "token_blocklist"

    id = db.Column(db.Integer, primary_key=True)
    jti = db.Column(db.String(36), nullable=False, unique=True, index=True)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))


class AuditLog(db.Model):
    __tablename__ = "audit_logs"

    # A flat "action" string rather than a fixed enum of event types —
    # matches every other model here: a small, evolving set of event kinds
    # doesn't need a table of its own, and a new action never needs a
    # migration. actor/target rows are never deleted (no user-delete
    # feature exists), so plain FKs are fine — nothing to cascade.
    id = db.Column(db.Integer, primary_key=True)
    actor_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    action = db.Column(db.String(50), nullable=False)
    target_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True, index=True)
    details = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), index=True)

    actor = db.relationship("User", foreign_keys=[actor_id])
    target_user = db.relationship("User", foreign_keys=[target_user_id])

    def to_dict(self):
        return {
            "id": self.id,
            "action": self.action,
            "actorName": self.actor.full_name if self.actor else None,
            "actorEmail": self.actor.email if self.actor else None,
            "targetName": self.target_user.full_name if self.target_user else None,
            "targetEmail": self.target_user.email if self.target_user else None,
            "details": self.details,
            "createdAt": self.created_at.isoformat(),
        }


class Department(db.Model):
    __tablename__ = "departments"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False, unique=True)
    description = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    doctors = db.relationship("Doctor", backref="department")

    def to_dict(self):
        return {"id": self.id, "name": self.name, "description": self.description}


class Doctor(db.Model):
    __tablename__ = "doctors"

    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(150), nullable=False)
    department_id = db.Column(db.Integer, db.ForeignKey("departments.id"), nullable=False, index=True)
    specialty = db.Column(db.String(150), nullable=False)
    bio = db.Column(db.Text, nullable=True)
    photo_url = db.Column(db.String(500), nullable=True)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    # Reserved for a future doctor self-service login — unused today, zero cost to have now.
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True, unique=True)

    availability = db.relationship("DoctorAvailability", backref="doctor", cascade="all, delete-orphan")

    def to_dict(self, include_availability=False):
        data = {
            "id": self.id,
            "fullName": self.full_name,
            "departmentId": self.department_id,
            "departmentName": self.department.name if self.department else None,
            "specialty": self.specialty,
            "bio": self.bio,
            "photoUrl": self.photo_url,
            "isActive": self.is_active,
        }
        if include_availability:
            data["availability"] = [a.to_dict() for a in self.availability]
        return data


class DoctorAvailability(db.Model):
    __tablename__ = "doctor_availability"

    id = db.Column(db.Integer, primary_key=True)
    doctor_id = db.Column(db.Integer, db.ForeignKey("doctors.id"), nullable=False, index=True)
    # 0 = Monday .. 6 = Sunday (Python's date.weekday() convention).
    weekday = db.Column(db.Integer, nullable=False)
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "weekday": self.weekday,
            "startTime": self.start_time.strftime("%H:%M"),
            "endTime": self.end_time.strftime("%H:%M"),
        }


class PatientProfile(db.Model):
    __tablename__ = "patient_profiles"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, unique=True, index=True)

    date_of_birth = db.Column(db.Date, nullable=True)
    phone = db.Column(db.String(30), nullable=True)
    address = db.Column(db.String(300), nullable=True)
    emergency_contact_name = db.Column(db.String(150), nullable=True)
    emergency_contact_phone = db.Column(db.String(30), nullable=True)
    blood_type = db.Column(db.String(5), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    user = db.relationship("User", backref=db.backref("patient_profile", uselist=False))

    def to_dict(self):
        return {
            "id": self.id,
            "userId": self.user_id,
            "dateOfBirth": self.date_of_birth.isoformat() if self.date_of_birth else None,
            "phone": self.phone,
            "address": self.address,
            "emergencyContactName": self.emergency_contact_name,
            "emergencyContactPhone": self.emergency_contact_phone,
            "bloodType": self.blood_type,
        }


class Appointment(db.Model):
    __tablename__ = "appointments"

    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey("patient_profiles.id"), nullable=False, index=True)
    doctor_id = db.Column(db.Integer, db.ForeignKey("doctors.id"), nullable=False, index=True)

    scheduled_start = db.Column(db.DateTime, nullable=False)
    scheduled_end = db.Column(db.DateTime, nullable=False)
    # scheduled | completed | cancelled | no_show
    status = db.Column(db.String(20), nullable=False, default="scheduled")
    reason = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    cancelled_at = db.Column(db.DateTime, nullable=True)
    cancellation_reason = db.Column(db.String(500), nullable=True)
    # Set once a reminder has actually gone out (see app/appointments/
    # reminders.py) — naive, like scheduled_start, so it can be compared
    # against it directly without a tz-aware/naive mismatch.
    reminder_sent_at = db.Column(db.DateTime, nullable=True)

    patient = db.relationship("PatientProfile")
    doctor = db.relationship("Doctor")

    __table_args__ = (
        db.Index("ix_appointments_doctor_window", "doctor_id", "scheduled_start", "scheduled_end"),
        db.Index("ix_appointments_patient_window", "patient_id", "scheduled_start"),
        # Cheap defense-in-depth against double-submit producing two
        # identical-start-time bookings for the same doctor. Does NOT stop
        # general overlap races at different start times — see
        # app/appointments/routes.py for the BEGIN IMMEDIATE transaction
        # that actually closes that gap. Partial (WHERE status != 'cancelled'),
        # not a blanket UniqueConstraint — a cancelled appointment must free
        # its slot for rebooking, and a plain unique constraint on
        # (doctor_id, scheduled_start) can't tell a cancelled row from a
        # live one.
        db.Index(
            "uq_appointments_doctor_start_active",
            "doctor_id", "scheduled_start",
            unique=True,
            sqlite_where=db.text("status != 'cancelled'"),
        ),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "patientId": self.patient_id,
            "patientName": self.patient.user.full_name if self.patient else None,
            "doctorId": self.doctor_id,
            "doctorName": self.doctor.full_name if self.doctor else None,
            "scheduledStart": self.scheduled_start.isoformat(),
            "scheduledEnd": self.scheduled_end.isoformat(),
            "status": self.status,
            "reason": self.reason,
            "createdAt": self.created_at.isoformat(),
            "cancelledAt": self.cancelled_at.isoformat() if self.cancelled_at else None,
            "cancellationReason": self.cancellation_reason,
        }


class Ward(db.Model):
    __tablename__ = "wards"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False, unique=True)
    ward_type = db.Column(db.String(100), nullable=False)
    floor = db.Column(db.String(20), nullable=True)

    beds = db.relationship("Bed", backref="ward", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "wardType": self.ward_type,
            "floor": self.floor,
        }


class Bed(db.Model):
    __tablename__ = "beds"

    id = db.Column(db.Integer, primary_key=True)
    ward_id = db.Column(db.Integer, db.ForeignKey("wards.id"), nullable=False, index=True)
    bed_number = db.Column(db.String(20), nullable=False)
    # available | occupied | maintenance — denormalized rather than derived
    # from Admission, since bed-board reads vastly outnumber admit/discharge
    # writes. Kept in sync with Admission inside the same transaction by
    # app/admissions/routes.py; the partial unique index on Admission below
    # is the actual DB-enforced guarantee, this column is a fast-read cache.
    status = db.Column(db.String(20), nullable=False, default="available")

    __table_args__ = (db.UniqueConstraint("ward_id", "bed_number", name="uq_beds_ward_number"),)

    def to_dict(self):
        return {
            "id": self.id,
            "wardId": self.ward_id,
            "wardName": self.ward.name if self.ward else None,
            "bedNumber": self.bed_number,
            "status": self.status,
        }


class Admission(db.Model):
    __tablename__ = "admissions"

    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey("patient_profiles.id"), nullable=False, index=True)
    bed_id = db.Column(db.Integer, db.ForeignKey("beds.id"), nullable=False, index=True)
    admitting_doctor_id = db.Column(db.Integer, db.ForeignKey("doctors.id"), nullable=True)

    admitted_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    discharged_at = db.Column(db.DateTime, nullable=True)
    reason = db.Column(db.String(500), nullable=True)
    # active | discharged
    status = db.Column(db.String(20), nullable=False, default="active")
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    patient = db.relationship("PatientProfile")
    bed = db.relationship("Bed")
    admitting_doctor = db.relationship("Doctor")

    __table_args__ = (
        # At most one active admission per bed. Unlike appointment overlap
        # (a range condition SQLite can't constrain directly), "is this bed
        # currently occupied" is a plain equality condition, so a partial
        # unique index enforces it exactly — a real DB guarantee, not just
        # app-layer discipline.
        db.Index(
            "uq_admissions_bed_active",
            "bed_id",
            unique=True,
            sqlite_where=db.text("discharged_at IS NULL"),
        ),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "patientId": self.patient_id,
            "patientName": self.patient.user.full_name if self.patient else None,
            "bedId": self.bed_id,
            "bedNumber": self.bed.bed_number if self.bed else None,
            "wardName": self.bed.ward.name if self.bed and self.bed.ward else None,
            "admittingDoctorId": self.admitting_doctor_id,
            "admittingDoctorName": self.admitting_doctor.full_name if self.admitting_doctor else None,
            "admittedAt": self.admitted_at.isoformat(),
            "dischargedAt": self.discharged_at.isoformat() if self.discharged_at else None,
            "reason": self.reason,
            "status": self.status,
        }


class Document(db.Model):
    __tablename__ = "documents"

    id = db.Column(db.Integer, primary_key=True)
    # Kept for audit/attribution only — NOT used to filter query results.
    # The knowledge base is shared clinic-wide (any authenticated user
    # can read it); only staff/admin can write to it. See app/documents/routes.py.
    uploaded_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    # general | policy | faq | directory_digest — feeds citation UI
    # ("Source: Visiting Hours Policy") and marks the auto-generated
    # doctor/department digest so it can be found and replaced on refresh.
    document_type = db.Column(db.String(30), nullable=False, default="general")

    filename = db.Column(db.String(255), nullable=False)
    uploaded_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    # pending -> processing -> ready | failed
    status = db.Column(db.String(20), nullable=False, default="pending")
    error_message = db.Column(db.String(500), nullable=True)
    page_count = db.Column(db.Integer, nullable=True)

    chunks = db.relationship("Chunk", backref="document", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "filename": self.filename,
            "documentType": self.document_type,
            "uploadedAt": self.uploaded_at.isoformat(),
            "status": self.status,
            "errorMessage": self.error_message,
            "pageCount": self.page_count,
        }


class Chunk(db.Model):
    __tablename__ = "chunks"

    id = db.Column(db.Integer, primary_key=True)
    document_id = db.Column(db.Integer, db.ForeignKey("documents.id"), nullable=False, index=True)

    page_number = db.Column(db.Integer, nullable=False)
    chunk_index = db.Column(db.Integer, nullable=False)
    text = db.Column(db.Text, nullable=False)
    # np.float32 bytes (EMBEDDING_DIM long), pre-normalized at write time so
    # retrieval-time cosine similarity is a plain dot product.
    embedding = db.Column(db.LargeBinary, nullable=False)


class Conversation(db.Model):
    __tablename__ = "conversations"

    id = db.Column(db.Integer, primary_key=True)
    owner_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    # Null => search across all of the owner's documents.
    document_id = db.Column(db.Integer, db.ForeignKey("documents.id"), nullable=True, index=True)
    title = db.Column(db.String(150), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    messages = db.relationship(
        "Message", backref="conversation", cascade="all, delete-orphan", order_by="Message.created_at"
    )
    document = db.relationship("Document")

    def to_dict(self):
        return {
            "id": self.id,
            "documentId": self.document_id,
            "title": self.title or (self.document.filename if self.document else "All documents"),
            "createdAt": self.created_at.isoformat(),
        }


class Message(db.Model):
    __tablename__ = "messages"

    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(db.Integer, db.ForeignKey("conversations.id"), nullable=False, index=True)

    role = db.Column(db.String(20), nullable=False)  # "user" | "assistant"
    content = db.Column(db.Text, nullable=False)
    cited_chunk_ids = db.Column(db.JSON, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "role": self.role,
            "content": self.content,
            "citedChunkIds": self.cited_chunk_ids or [],
            "createdAt": self.created_at.isoformat(),
        }
