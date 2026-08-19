from flask import Blueprint

patients_bp = Blueprint("patients", __name__, url_prefix="/api/patients")

from app.patients import routes  # noqa: E402,F401
