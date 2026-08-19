from flask import Blueprint

admissions_bp = Blueprint("admissions", __name__, url_prefix="/api/admissions")
wards_bp = Blueprint("wards", __name__, url_prefix="/api/wards")

from app.admissions import routes  # noqa: E402,F401
