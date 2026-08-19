from flask import request, jsonify
from flask_jwt_extended import jwt_required
from werkzeug.utils import secure_filename

from app.documents import documents_bp
from app.extensions import db
from app.models import Document
from app.constants import ALLOWED_EXTENSIONS
from app.utils import current_user_id
from app.auth.decorators import staff_required
from app.documents.ingestion import ingest_document


def _allowed(filename):
    return "." in filename and filename.rsplit(".", 1)[-1].lower() in ALLOWED_EXTENSIONS


@documents_bp.route("", methods=["GET"])
@jwt_required()
def list_documents():
    # Shared clinic-wide knowledge base — any authenticated user (patient
    # or staff) can browse it. Only staff can write to it (see below).
    documents = Document.query.order_by(Document.uploaded_at.desc()).all()
    return jsonify({"documents": [d.to_dict() for d in documents]}), 200


@documents_bp.route("", methods=["POST"])
@staff_required
def upload_document():
    file = request.files.get("file")
    if file is None or file.filename == "":
        return jsonify({"error": "A file is required."}), 400
    if not _allowed(file.filename):
        return jsonify({"error": "Only PDF and TXT files are supported."}), 400

    filename = secure_filename(file.filename)
    file_bytes = file.read()
    document_type = (request.form.get("documentType") or "general").strip()

    document = Document(
        uploaded_by=current_user_id(), filename=filename, document_type=document_type, status="pending"
    )
    db.session.add(document)
    db.session.commit()

    # Synchronous by design — see app/documents/ingestion.py docstring.
    ingest_document(document, file_bytes, filename)

    return jsonify({"document": document.to_dict()}), 201


@documents_bp.route("/<int:document_id>", methods=["GET"])
@jwt_required()
def get_document(document_id):
    document = db.session.get(Document, document_id)
    if document is None:
        return jsonify({"error": "Document not found."}), 404
    return jsonify({"document": document.to_dict()}), 200


@documents_bp.route("/<int:document_id>", methods=["DELETE"])
@staff_required
def delete_document(document_id):
    document = db.session.get(Document, document_id)
    if document is None:
        return jsonify({"error": "Document not found."}), 404

    db.session.delete(document)
    db.session.commit()
    return "", 204
