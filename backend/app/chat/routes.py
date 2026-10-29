import json

from flask import request, jsonify, Response, stream_with_context, current_app
from flask_jwt_extended import get_jwt, jwt_required

from app.chat import chat_bp
from app.extensions import db, limiter
from app.models import Document, Conversation, Message, Chunk
from app.utils import current_user_id
from app.ml import embed_query
from app.chat.retrieval import retrieve, retrieve_keyword, is_low_confidence
from app.constants import KEYWORD_MIN_SCORE
from app.chat.generation import build_prompt, stream_answer
from app.chat.account_context import build_account_context
from app.chat.greetings import is_pure_greeting, GREETING_RESPONSE
from app.chat.guardrails import (
    MAX_QUESTION_CHARS,
    OUTPUT_BLOCKED_REPLY,
    TOO_LONG_TEMPLATE,
    OutputGuard,
    screen_question,
)
from app.chat.injection_guard import log_if_suspicious
from app.pagination import paginate


def _sse(event, data):
    payload = json.dumps(data)
    if event:
        return f"event: {event}\ndata: {payload}\n\n"
    return f"data: {payload}\n\n"


def _citations_for(message):
    """Resolves a persisted message's cited_chunk_ids into displayable
    {index, chunkId, pageNumber, excerpt} entries, in the same [1]..[k]
    order the chunks were presented to the model in. Looked up at read
    time rather than stored, so citation text always reflects the current
    Chunk rows (e.g. if a document is later re-ingested)."""
    if not message.cited_chunk_ids:
        return []
    chunks_by_id = {c.id: c for c in Chunk.query.filter(Chunk.id.in_(message.cited_chunk_ids)).all()}
    citations = []
    for i, chunk_id in enumerate(message.cited_chunk_ids, start=1):
        chunk = chunks_by_id.get(chunk_id)
        if chunk is None:
            continue
        excerpt = chunk.text if len(chunk.text) <= 220 else chunk.text[:220].rsplit(" ", 1)[0] + "…"
        citations.append({"index": i, "chunkId": chunk.id, "pageNumber": chunk.page_number, "excerpt": excerpt})
    return citations


def _message_dict(message):
    return {**message.to_dict(), "citations": _citations_for(message)}


@chat_bp.route("/conversations", methods=["POST"])
@jwt_required()
def create_conversation():
    data = request.get_json(silent=True) or {}
    document_id = data.get("documentId")

    if document_id is not None:
        # Document lookup is intentionally not owner-scoped — the knowledge
        # base is shared clinic-wide, any authenticated user may start a
        # conversation scoped to any existing document.
        doc = db.session.get(Document, document_id)
        if doc is None:
            return jsonify({"error": "Document not found."}), 404

    conversation = Conversation(owner_id=current_user_id(), document_id=document_id)
    db.session.add(conversation)
    db.session.commit()
    return jsonify({"conversation": conversation.to_dict()}), 201


@chat_bp.route("/conversations", methods=["GET"])
@jwt_required()
def list_conversations():
    query = Conversation.query.filter_by(owner_id=current_user_id()).order_by(Conversation.created_at.desc())
    conversations, meta = paginate(query)
    return jsonify({"conversations": [c.to_dict() for c in conversations], **meta}), 200


@chat_bp.route("/conversations/<int:conversation_id>", methods=["DELETE"])
@jwt_required()
def delete_conversation(conversation_id):
    conversation = Conversation.query.filter_by(id=conversation_id, owner_id=current_user_id()).first()
    if conversation is None:
        return jsonify({"error": "Conversation not found."}), 404
    # cascade="all, delete-orphan" on Conversation.messages takes its
    # attached Messages with it — no separate cleanup needed.
    db.session.delete(conversation)
    db.session.commit()
    return "", 204


@chat_bp.route("/conversations/<int:conversation_id>/export", methods=["GET"])
@jwt_required()
def export_conversation(conversation_id):
    conversation = Conversation.query.filter_by(id=conversation_id, owner_id=current_user_id()).first()
    if conversation is None:
        return jsonify({"error": "Conversation not found."}), 404

    lines = [
        "Floss Clinic — Conversation Export",
        f"Started: {conversation.created_at.strftime('%B %d, %Y at %I:%M %p')}",
        "",
    ]
    for message in conversation.messages:
        speaker = "You" if message.role == "user" else "Floss Assistant"
        when = message.created_at.strftime("%b %d, %Y %I:%M %p")
        lines.append(f"{speaker} ({when}):")
        lines.append(message.content)
        lines.append("")

    return Response(
        "\n".join(lines),
        mimetype="text/plain",
        headers={"Content-Disposition": f'attachment; filename="floss-conversation-{conversation.id}.txt"'},
    )


@chat_bp.route("/conversations/<int:conversation_id>/messages", methods=["GET"])
@jwt_required()
def list_messages(conversation_id):
    conversation = Conversation.query.filter_by(id=conversation_id, owner_id=current_user_id()).first()
    if conversation is None:
        return jsonify({"error": "Conversation not found."}), 404
    return jsonify({"messages": [_message_dict(m) for m in conversation.messages]}), 200


@chat_bp.route("/conversations/<int:conversation_id>/messages", methods=["POST"])
@jwt_required()
@limiter.limit("15 per minute")
def post_message(conversation_id):
    conversation = Conversation.query.filter_by(id=conversation_id, owner_id=current_user_id()).first()
    if conversation is None:
        return jsonify({"error": "Conversation not found."}), 404

    data = request.get_json(silent=True) or {}
    query = (data.get("content") or "").strip()
    if not query:
        return jsonify({"error": "A message is required."}), 400
    if len(query) > MAX_QUESTION_CHARS:
        return jsonify({"error": TOO_LONG_TEMPLATE.format(limit=MAX_QUESTION_CHARS)}), 400

    # Visibility only, never blocking — see injection_guard's docstring for
    # why this doesn't refuse the request.
    log_if_suspicious(current_app.logger, current_user_id(), "chat_query", query)

    # The unambiguous cases (probing the system's security, extracting the
    # assistant's instructions, asking for other people's data) are answered
    # with a fixed reply and never reach the model — see guardrails.py.
    screened = screen_question(query)
    if screened is not None:
        current_app.logger.warning(
            "Chat guardrail blocked a %s request (user_id=%s): %r", screened.category, current_user_id(), query[:200]
        )

    db.session.add(Message(conversation_id=conversation.id, role="user", content=query))
    db.session.commit()

    greeting = is_pure_greeting(query)
    role = get_jwt().get("role")
    canned_reply = screened.reply if screened is not None else (GREETING_RESPONSE if greeting else None)
    # Skip embedding/retrieval/account-lookup entirely for a bare "hi" or a
    # screened request — none of that work is needed to answer them, and the
    # canned reply is a better response than routing them through the model.
    if canned_reply is not None:
        doc_results = []
        account_context = None
    else:
        try:
            query_vector = embed_query(query)
            results = retrieve(conversation.document_id, query_vector)
            low_confidence = is_low_confidence(results)
        except Exception:  # noqa: BLE001 - embedding service down (no credits, outage): degrade, don't 500
            # The query embedding comes from a remote API (see app/ml.py). If
            # it fails, answer from keyword matches over the same chunks
            # rather than failing the whole chat request.
            current_app.logger.warning("Embedding unavailable; falling back to keyword retrieval", exc_info=True)
            results = retrieve_keyword(conversation.document_id, query)
            low_confidence = is_low_confidence(results, KEYWORD_MIN_SCORE)
        # Live per-user data (this user's own appointments) — see
        # app/chat/account_context.py. None for staff/admin (no PatientProfile),
        # so their behavior is unchanged.
        account_context = build_account_context(current_user_id(), query)
        # Excluded from the prompt as citable sources when low-confidence —
        # not because the model isn't consulted at all (it always is, see
        # below), just so it doesn't present a probably-irrelevant chunk as
        # an authoritative numbered source. The model still answers from its
        # own general dental knowledge or the account context if either
        # applies — see SYSTEM_PROMPT.
        doc_results = [] if low_confidence else results
    conversation_id_ = conversation.id  # captured for the generator, run after this request's own context
    user_id_ = current_user_id()

    def generate():
        answer_parts = []

        if canned_reply is not None:
            answer_parts.append(canned_reply)
            yield _sse(None, canned_reply)
            cited_ids = []
        else:
            cited_ids = [chunk.id for chunk, _score in doc_results]
            guard = OutputGuard()
            try:
                for token in stream_answer(build_prompt(query, doc_results, account_context, role)):
                    safe = guard.feed(token)
                    if guard.blocked:
                        break
                    if safe:
                        answer_parts.append(safe)
                        yield _sse(None, safe)
                if not guard.blocked:
                    tail = guard.flush()
                    if tail:
                        answer_parts.append(tail)
                        yield _sse(None, tail)
            except Exception:
                # Gemini unreachable/misconfigured/rate-limited mid-stream —
                # tell the client and don't persist a half-formed reply. Log
                # the real cause server-side; the client only ever sees the
                # generic message below.
                current_app.logger.exception("Chat generation failed")
                db.session.rollback()
                yield _sse("error", {"error": "The assistant is temporarily unavailable. Please try again shortly."})
                return
            if guard.blocked:
                # The reply contained something that must never leave the
                # server (a key, a token, the prompt itself). Whatever already
                # streamed was safe; the stored/final message becomes a plain
                # refusal, and the client replaces the bubble with it.
                current_app.logger.warning("Chat output guard blocked a reply (user_id=%s)", user_id_)
                answer_parts = [OUTPUT_BLOCKED_REPLY]
                cited_ids = []

        assistant_message = Message(
            conversation_id=conversation_id_,
            role="assistant",
            content="".join(answer_parts),
            cited_chunk_ids=cited_ids,
        )
        db.session.add(assistant_message)
        db.session.commit()
        yield _sse("done", _message_dict(assistant_message))

    return Response(stream_with_context(generate()), mimetype="text/event-stream")
