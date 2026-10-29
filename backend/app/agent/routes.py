import time
from datetime import datetime

from flask import current_app, jsonify, request
from flask_jwt_extended import jwt_required

from app.agent import agent_bp
from app.agent.actions import ActionError, confirm_action, get_own_action, reject_action
from app.agent.limits import HISTORY_MESSAGE_CHARS, HISTORY_MESSAGES
from app.agent.loop import run_agent
from app.agent.providers import ProviderBusyError, get_provider
from app.agent.tools import ToolContext
from app.chat.injection_guard import log_if_suspicious
from app.extensions import db, limiter
from app.models import AgentAction, Conversation, Message, PatientProfile
from app.utils import current_user_id

MAX_MESSAGE_CHARS = 1000
BUSY_MESSAGE = (
    "The booking assistant is busy right now. You can book directly from the Dentists page "
    "(choose a dentist and pick a time), or try again in a few minutes."
)


def _shorten(text):
    text = text or ""
    return text if len(text) <= HISTORY_MESSAGE_CHARS else text[: HISTORY_MESSAGE_CHARS - 1].rstrip() + "…"


def _patient():
    return PatientProfile.query.filter_by(user_id=current_user_id()).first()


def _own_conversation(conversation_id):
    return Conversation.query.filter_by(id=conversation_id, owner_id=current_user_id()).first()


@agent_bp.route("/status", methods=["GET"])
@jwt_required()
def status():
    """Lets the frontend decide whether to offer booking mode at all: needs a
    configured model, and a patient account (staff have no patient profile)."""
    provider = get_provider(current_app.config)
    enabled = provider is not None and _patient() is not None
    return (
        jsonify(
            {
                "enabled": enabled,
                "provider": provider.name if enabled else None,
                # False while every model is rate-limited, so the UI can say
                # so up front rather than letting a message fail.
                "available": bool(enabled and getattr(provider, "available", lambda: True)()),
            }
        ),
        200,
    )


@agent_bp.route("/conversations/<int:conversation_id>/messages", methods=["POST"])
@jwt_required()
@limiter.limit("15 per minute")
def post_message(conversation_id):
    conversation = _own_conversation(conversation_id)
    if conversation is None:
        return jsonify({"error": "Conversation not found."}), 404

    patient = _patient()
    if patient is None:
        # Staff and admin have no patient profile; booking on someone's
        # behalf stays a deliberate staff action in the normal UI.
        return jsonify({"error": "The booking assistant is for patient accounts."}), 403

    provider = get_provider(current_app.config)
    if provider is None:
        return jsonify({"error": "The booking assistant isn't available right now."}), 503

    data = request.get_json(silent=True) or {}
    text = (data.get("content") or "").strip()
    if not text:
        return jsonify({"error": "A message is required."}), 400
    if len(text) > MAX_MESSAGE_CHARS:
        return jsonify({"error": f"Please keep messages under {MAX_MESSAGE_CHARS} characters."}), 400

    log_if_suspicious(current_app.logger, current_user_id(), "agent_message", text)

    # Earlier turns as plain text; tool traffic is never replayed from storage.
    history = [
        {"role": m.role, "text": _shorten(m.content)}
        for m in conversation.messages[-HISTORY_MESSAGES:]
        if m.role in ("user", "assistant")
    ]
    ctx = ToolContext(
        user_id=current_user_id(),
        patient=patient,
        conversation_id=conversation.id,
        logger=current_app.logger,
    )

    started = time.monotonic()
    try:
        result = run_agent(provider, ctx, history, text)
    except ProviderBusyError as exc:
        # Rate-limited, not broken: say so plainly and point at the normal
        # booking page, which needs no model and always works. Nothing stored,
        # so the patient can simply resend.
        current_app.logger.warning(
            "Booking assistant busy after %.1fs: every model is rate-limited (shortest wait %.0fs)",
            time.monotonic() - started, exc.retry_after or 0,
        )
        db.session.rollback()
        return (
            jsonify(
                {
                    "error": BUSY_MESSAGE,
                    "code": "assistant_busy",
                    "retryAfterSeconds": int(exc.retry_after) if exc.retry_after else None,
                }
            ),
            503,
        )
    except Exception:  # noqa: BLE001 - model/network failure: don't 500, don't store half a turn
        current_app.logger.exception("Booking assistant failed")
        db.session.rollback()
        return jsonify({"error": "The assistant is temporarily unavailable. Please try again shortly."}), 502

    current_app.logger.info(
        "Booking assistant answered in %.1fs: %d model call(s), served by %s, waited %.1fs on rate limits",
        time.monotonic() - started, result.steps, getattr(provider, "served", None) or provider.name,
        getattr(provider, "waited", 0.0),
    )
    db.session.add(Message(conversation_id=conversation.id, role="user", content=text))
    reply = Message(conversation_id=conversation.id, role="assistant", content=result.text, cited_chunk_ids=[])
    db.session.add(reply)
    db.session.commit()
    return (
        jsonify(
            {
                "message": reply.to_dict(),
                "pendingActions": [a.to_dict() for a in result.new_actions],
                "steps": result.steps,
            }
        ),
        200,
    )


@agent_bp.route("/conversations/<int:conversation_id>/actions", methods=["GET"])
@jwt_required()
def list_actions(conversation_id):
    """Pending requests for one conversation, so the confirm cards survive a page reload."""
    if _own_conversation(conversation_id) is None:
        return jsonify({"error": "Conversation not found."}), 404

    actions = (
        AgentAction.query.filter(
            AgentAction.user_id == current_user_id(),
            AgentAction.conversation_id == conversation_id,
            AgentAction.status == "pending",
            AgentAction.expires_at > datetime.now(),
        )
        .order_by(AgentAction.created_at)
        .all()
    )
    return jsonify({"actions": [a.to_dict() for a in actions]}), 200


def _resolve(action_id, resolver):
    action = get_own_action(current_user_id(), action_id)
    if action is None:
        return jsonify({"error": "Request not found."}), 404
    try:
        resolver(action)
    except ActionError as exc:
        return jsonify({"error": str(exc), "action": action.to_dict()}), exc.status_code
    return jsonify({"action": action.to_dict()}), 200


@agent_bp.route("/actions/<int:action_id>/confirm", methods=["POST"])
@jwt_required()
@limiter.limit("30 per hour")
def confirm(action_id):
    patient = _patient()
    if patient is None:
        return jsonify({"error": "The booking assistant is for patient accounts."}), 403
    return _resolve(action_id, lambda action: confirm_action(action, patient))


@agent_bp.route("/actions/<int:action_id>/reject", methods=["POST"])
@jwt_required()
def reject(action_id):
    return _resolve(action_id, reject_action)
