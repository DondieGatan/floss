import json

from flask import request, jsonify, Response, stream_with_context, current_app
from flask_jwt_extended import jwt_required

from app.chat import chat_bp
from app.extensions import db, limiter
from app.models import Document, Conversation, Message, Chunk
from app.utils import current_user_id
from app.ml import embed_query
from app.chat.retrieval import retrieve, is_low_confidence
from app.chat.generation import build_prompt, stream_answer
from app.chat.account_context import build_account_context
from app.chat.greetings import is_pure_greeting, GREETING_RESPONSE
from app.chat.injection_guard import log_if_suspicious

FALLBACK_MESSAGE = "I don't have enough information in the uploaded document(s) to answer that."


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
    conversations = (
        Conversation.query.filter_by(owner_id=current_user_id())
        .order_by(Conversation.created_at.desc())
        .all()
    )
    return jsonify({"conversations": [c.to_dict() for c in conversations]}), 200


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

    # Visibility only, never blocking — see injection_guard's docstring for
    # why this doesn't refuse the request.
    log_if_suspicious(current_app.logger, current_user_id(), "chat_query", query)

    db.session.add(Message(conversation_id=conversation.id, role="user", content=query))
    db.session.commit()

    greeting = is_pure_greeting(query)
    # Skip embedding/retrieval/account-lookup entirely for a bare "hi" —
    # none of that work is needed to answer it, and it'd otherwise fall
    # through to the low-confidence fallback ("I don't have enough
    # information"), which is a bad response to a greeting.
    if greeting:
        doc_results = []
        account_context = None
        has_context = True
    else:
        query_vector = embed_query(query)
        results = retrieve(conversation.document_id, query_vector)
        low_confidence = is_low_confidence(results)
        # Live per-user data (this user's own appointments) — see
        # app/chat/account_context.py. None for staff/admin (no PatientProfile),
        # so their behavior is unchanged.
        account_context = build_account_context(current_user_id(), query)
        doc_results = [] if low_confidence else results
        has_context = bool(doc_results) or account_context is not None
    conversation_id_ = conversation.id  # captured for the generator, run after this request's own context

    def generate():
        answer_parts = []

        if greeting:
            answer_parts.append(GREETING_RESPONSE)
            yield _sse(None, GREETING_RESPONSE)
            cited_ids = []
        elif not has_context:
            answer_parts.append(FALLBACK_MESSAGE)
            yield _sse(None, FALLBACK_MESSAGE)
            cited_ids = []
        else:
            cited_ids = [chunk.id for chunk, _score in doc_results]
            try:
                for token in stream_answer(build_prompt(query, doc_results, account_context)):
                    answer_parts.append(token)
                    yield _sse(None, token)
            except Exception:
                # Groq unreachable/misconfigured/rate-limited mid-stream —
                # tell the client and don't persist a half-formed reply.
                db.session.rollback()
                yield _sse("error", {"error": "The assistant is temporarily unavailable. Please try again shortly."})
                return

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
