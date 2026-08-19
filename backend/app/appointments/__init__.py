from flask import Blueprint

appointments_bp = Blueprint("appointments", __name__, url_prefix="/api/appointments")

from app.appointments import routes  # noqa: E402,F401
