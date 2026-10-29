from flask import Blueprint

internal_bp = Blueprint("internal", __name__, url_prefix="/api/internal")

from app.internal import routes  # noqa: E402,F401
