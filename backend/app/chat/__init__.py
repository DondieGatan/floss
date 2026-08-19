from flask import Blueprint

chat_bp = Blueprint("chat", __name__, url_prefix="/api/chat")

from app.chat import routes  # noqa: E402,F401
