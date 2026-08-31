"""One-off admin script: promote an existing user to a given role.

Public self-registration always creates a 'patient' account (see
app/auth/routes.py register()) — staff/admin/owner accounts are meant to be
provisioned out-of-band, which this script is. Run against whichever
database DATABASE_URL (in .env, or the environment) points at — point it at
the live DATABASE_URL to promote a live account, or leave it unset to hit
local dev's sqlite db.

Usage:
    python promote_user.py <email> <role>

Example:
    python promote_user.py dondiegodwin@gmail.com owner
"""
import sys

from app import create_app, db
from app.models import User

VALID_ROLES = {"patient", "staff", "admin", "owner"}


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)

    email, role = sys.argv[1].strip().lower(), sys.argv[2].strip().lower()
    if role not in VALID_ROLES:
        print(f"Invalid role {role!r} — must be one of {sorted(VALID_ROLES)}")
        sys.exit(1)

    app = create_app()
    with app.app_context():
        user = User.query.filter_by(email=email).first()
        if user is None:
            print(f"No user found with email {email!r}")
            sys.exit(1)

        old_role = user.role
        if old_role == role:
            print(f"{email} is already {role!r} — nothing to do.")
            return

        user.role = role
        db.session.commit()
        print(f"Promoted {email} (id={user.id}): {old_role!r} -> {role!r}")


if __name__ == "__main__":
    main()
