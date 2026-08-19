"""Auto-generated "Dentist & Department Directory" document: renders the
current staff-curated directory data to plain text and re-runs the *same*
chunk -> embed -> persist pipeline used for uploaded files, against one
system-owned Document (document_type='directory_digest'). No new retrieval
or prompt-branching logic — the chatbot cites this document exactly like
any other upload ("According to the Dentist Directory[1]...").

Trade-off, worth being explicit about: directory answers are only as fresh
as the last regeneration (triggered synchronously from the Doctor/Department
staff routes on create/update/delete), not a live query — acceptable at this
app's scope, not a real-time guarantee.
"""
from app.documents.ingestion import chunk_text

DIGEST_FILENAME = "Dentist & Department Directory.txt"
_WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def _render_directory_text():
    from app.models import Department

    departments = Department.query.order_by(Department.name).all()
    lines = []
    for dept in departments:
        lines.append(f"Department: {dept.name}")
        if dept.description:
            lines.append(dept.description)

        active_doctors = sorted((d for d in dept.doctors if d.is_active), key=lambda d: d.full_name)
        if not active_doctors:
            lines.append("No dentists are currently listed in this department.")
        for doctor in active_doctors:
            lines.append(f"Dentist: {doctor.full_name}, Specialty: {doctor.specialty}.")
            if doctor.bio:
                lines.append(doctor.bio)
            if doctor.availability:
                windows = ", ".join(
                    f"{_WEEKDAY_NAMES[a.weekday]} {a.start_time.strftime('%H:%M')}-{a.end_time.strftime('%H:%M')}"
                    for a in sorted(doctor.availability, key=lambda a: a.weekday)
                )
                lines.append(f"Available: {windows}.")
            else:
                lines.append("No published availability for this dentist yet.")
        lines.append("")

    return "\n".join(lines).strip()


def regenerate_directory_digest(triggered_by_user_id):
    """Never raises — a digest-refresh failure must not break the Doctor/
    Department CRUD request that triggered it. Mirrors ingest_document's
    broad except for the same reason."""
    from app.extensions import db
    from app.models import Document, Chunk
    from app.ml import embed_texts

    document = Document.query.filter_by(document_type="directory_digest").first()
    if document is None:
        document = Document(
            uploaded_by=triggered_by_user_id,
            filename=DIGEST_FILENAME,
            document_type="directory_digest",
            status="pending",
        )
        db.session.add(document)
        db.session.flush()
    else:
        document.uploaded_by = triggered_by_user_id
        Chunk.query.filter_by(document_id=document.id).delete()

    document.status = "processing"
    db.session.commit()

    try:
        text = _render_directory_text()
        if not text:
            document.status = "failed"
            document.error_message = "No department/doctor data to summarize yet."
            document.page_count = 0
            db.session.commit()
            return document

        chunks = chunk_text(text)
        vectors = embed_texts(chunks)
        for idx, (chunk, vector) in enumerate(zip(chunks, vectors)):
            db.session.add(Chunk(document_id=document.id, page_number=1, chunk_index=idx, text=chunk, embedding=vector.tobytes()))

        document.status = "ready"
        document.page_count = 1
        db.session.commit()
    except Exception as exc:  # noqa: BLE001 - deliberately broad, see docstring
        db.session.rollback()
        document.status = "failed"
        document.error_message = f"Failed to regenerate directory digest: {exc}"[:500]
        db.session.commit()

    return document
