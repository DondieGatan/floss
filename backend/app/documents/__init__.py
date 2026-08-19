from flask import Blueprint

documents_bp = Blueprint("documents", __name__, url_prefix="/api/documents")

from app.documents import routes  # noqa: E402,F401
