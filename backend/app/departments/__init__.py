from flask import Blueprint

departments_bp = Blueprint("departments", __name__, url_prefix="/api/departments")

from app.departments import routes  # noqa: E402,F401
