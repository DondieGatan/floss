"""Auto-generated "Dentist & Department Directory" document: renders the
current staff-curated directory data into one chunk per department and one
per active doctor (not the generic prose chunk_text() used for uploads —
see _directory_chunks' docstring for why), embeds and persists them against
one system-owned Document (document_type='directory_digest'). No new
retrieval or prompt-branching logic — the chatbot cites this document
exactly like any other upload ("According to the Dentist Directory[1]...").

Trade-off, worth being explicit about: directory answers are only as fresh
as the last regeneration (triggered synchronously from the Doctor/Department
staff routes on create/update/delete), not a live query — acceptable at this
app's scope, not a real-time guarantee.
"""
DIGEST_FILENAME = "Dentist & Department Directory.txt"
_WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def _directory_chunks():
    """One chunk per department plus one chunk per active doctor, instead of
    rendering the whole directory as one blob and running it through the
    generic prose chunker (chunk_text, ~900 chars). That packed 3-4
    unrelated doctors into a single chunk, and embedding a chunk that's
    part-Priya-Nair, part-Thomas-Okafor, part-Amara-Osei dilutes the vector
    enough that a query naming one specific dentist scored well under
    SIMILARITY_THRESHOLD even though their info was right there — confirmed
    by embedding the same sentence alone (0.71 similarity) vs. packed into
    its original chunk (0.16). One coherent entity per chunk fixes that."""
    from app.models import Department

    departments = Department.query.order_by(Department.name).all()
    chunks = []
    for dept in departments:
        active_doctors = sorted((d for d in dept.doctors if d.is_active), key=lambda d: d.full_name)

        dept_lines = [f"Department: {dept.name}"]
        if dept.description:
            dept_lines.append(dept.description)
        if active_doctors:
            dept_lines.append("Dentists in this department: " + ", ".join(d.full_name for d in active_doctors) + ".")
        else:
            dept_lines.append("No dentists are currently listed in this department.")
        chunks.append(" ".join(dept_lines))

        for doctor in active_doctors:
            lines = [f"Department: {dept.name}", f"Dentist: {doctor.full_name}, Specialty: {doctor.specialty}."]
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
            chunks.append(" ".join(lines))

    return chunks


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
        chunks = _directory_chunks()
        if not chunks:
            document.status = "failed"
            document.error_message = "No department/doctor data to summarize yet."
            document.page_count = 0
            db.session.commit()
            return document

        vectors = embed_texts(chunks)
        for idx, (chunk, vector) in enumerate(zip(chunks, vectors)):
            db.session.add(Chunk(document_id=document.id, page_number=1, chunk_index=idx, text=chunk, embedding=vector.tobytes()))

        document.status = "ready"
        document.page_count = 1
        document.error_message = None
        db.session.commit()
    except Exception as exc:  # noqa: BLE001 - deliberately broad, see docstring
        db.session.rollback()
        document.status = "failed"
        document.error_message = f"Failed to regenerate directory digest: {exc}"[:500]
        db.session.commit()

    return document
