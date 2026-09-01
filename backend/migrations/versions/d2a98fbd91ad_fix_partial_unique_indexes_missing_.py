"""fix partial unique indexes missing postgresql_where

Two of this app's partial unique indexes (Appointment's
uq_appointments_doctor_start_active and Admission's uq_admissions_bed_active)
were defined with only sqlite_where, never postgresql_where. SQLAlchemy's
dialect-prefixed Index kwargs (sqlite_where, postgresql_where, ...) each
only take effect for their own dialect — sqlite_where is silently ignored
everywhere else. Local dev/tests run on SQLite, where it DOES apply, so
this was invisible there; every environment that actually runs on Postgres
(production) ended up with a *plain*, non-partial unique index instead:

- uq_appointments_doctor_start_active: meant to exclude cancelled rows, so
  a slot frees up for rebooking after a cancellation
  (test_cancelled_appointment_frees_its_slot_for_rebooking passes locally).
  On the live Postgres index (confirmed via pg_indexes — no WHERE clause
  at all), cancelling an appointment and then rebooking that exact same
  (doctor, start) slot hits a real duplicate-key IntegrityError instead.

- uq_admissions_bed_active: meant to allow only one *active*
  (discharged_at IS NULL) admission per bed at a time. On the live Postgres
  index (also confirmed via pg_indexes — plain unique index on bed_id
  alone), a bed can never be admitted to more than once in its entire
  lifetime, discharged or not — the second admission ever attempted for
  any given bed 500s.

Revision ID: d2a98fbd91ad
Revises: 193c531a7adb
Create Date: 2026-09-01 06:08:32.718324

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd2a98fbd91ad'
down_revision = '193c531a7adb'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('appointments', schema=None) as batch_op:
        batch_op.drop_index('uq_appointments_doctor_start_active')
        batch_op.create_index(
            'uq_appointments_doctor_start_active',
            ['doctor_id', 'scheduled_start'],
            unique=True,
            sqlite_where=sa.text("status != 'cancelled'"),
            postgresql_where=sa.text("status != 'cancelled'"),
        )

    with op.batch_alter_table('admissions', schema=None) as batch_op:
        batch_op.drop_index('uq_admissions_bed_active')
        batch_op.create_index(
            'uq_admissions_bed_active',
            ['bed_id'],
            unique=True,
            sqlite_where=sa.text("discharged_at IS NULL"),
            postgresql_where=sa.text("discharged_at IS NULL"),
        )


def downgrade():
    with op.batch_alter_table('appointments', schema=None) as batch_op:
        batch_op.drop_index('uq_appointments_doctor_start_active')
        batch_op.create_index(
            'uq_appointments_doctor_start_active',
            ['doctor_id', 'scheduled_start'],
            unique=True,
            sqlite_where=sa.text("status != 'cancelled'"),
        )

    with op.batch_alter_table('admissions', schema=None) as batch_op:
        batch_op.drop_index('uq_admissions_bed_active')
        batch_op.create_index(
            'uq_admissions_bed_active',
            ['bed_id'],
            unique=True,
            sqlite_where=sa.text("discharged_at IS NULL"),
        )
