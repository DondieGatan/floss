from flask import Blueprint

public_bp = Blueprint("public", __name__, url_prefix="/api/public")

from app.public import routes  # noqa: E402,F401
