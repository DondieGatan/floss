from app.models import Chunk, Document


def test_creating_department_generates_ready_digest_document(client, staff_headers, app):
    resp = client.post("/api/departments", headers=staff_headers, json={"name": "Cardiology"})
    assert resp.status_code == 201

    with app.app_context():
        digest = Document.query.filter_by(document_type="directory_digest").first()
        assert digest is not None
        assert digest.status == "ready"
        assert digest.filename == "Dentist & Department Directory.txt"
        assert Chunk.query.filter_by(document_id=digest.id).count() > 0


def test_digest_is_a_single_document_regenerated_in_place(client, staff_headers, app):
    dept_id = client.post(
        "/api/departments", headers=staff_headers, json={"name": "Cardiology"}
    ).get_json()["department"]["id"]
    client.post(
        "/api/doctors",
        headers=staff_headers,
        json={"fullName": "Dr. Jane Smith", "departmentId": dept_id, "specialty": "Cardiology"},
    )
    client.post("/api/departments", headers=staff_headers, json={"name": "Neurology"})

    with app.app_context():
        digests = Document.query.filter_by(document_type="directory_digest").all()
        assert len(digests) == 1


def test_digest_chunks_are_replaced_not_accumulated(client, staff_headers, app):
    client.post("/api/departments", headers=staff_headers, json={"name": "Cardiology"})
    with app.app_context():
        digest_id = Document.query.filter_by(document_type="directory_digest").first().id
        first_count = Chunk.query.filter_by(document_id=digest_id).count()

    client.post("/api/departments", headers=staff_headers, json={"name": "Neurology"})

    # Regeneration replaces chunks in place rather than appending — a
    # doctor/department line appears exactly once in the digest, not
    # duplicated across regenerations.
    with app.app_context():
        texts = [c.text for c in Chunk.query.filter_by(document_id=digest_id).all()]
        assert len(texts) > 0
        assert len(texts) == len(set(texts))
        assert sum(t.count("Cardiology") for t in texts) == 1


def test_digest_includes_doctor_availability(client, staff_headers, app):
    dept_id = client.post(
        "/api/departments", headers=staff_headers, json={"name": "Cardiology"}
    ).get_json()["department"]["id"]
    doctor_id = client.post(
        "/api/doctors",
        headers=staff_headers,
        json={"fullName": "Dr. Jane Smith", "departmentId": dept_id, "specialty": "Cardiology"},
    ).get_json()["doctor"]["id"]
    client.post(
        f"/api/doctors/{doctor_id}/availability",
        headers=staff_headers,
        json={"weekday": 0, "startTime": "09:00", "endTime": "13:00"},
    )

    with app.app_context():
        digest = Document.query.filter_by(document_type="directory_digest").first()
        full_text = " ".join(c.text for c in Chunk.query.filter_by(document_id=digest.id).all())
        assert "Dr. Jane Smith" in full_text
        assert "Monday" in full_text
        assert "09:00-13:00" in full_text


def test_deactivating_doctor_removes_them_from_digest(client, staff_headers, app):
    dept_id = client.post(
        "/api/departments", headers=staff_headers, json={"name": "Cardiology"}
    ).get_json()["department"]["id"]
    doctor_id = client.post(
        "/api/doctors",
        headers=staff_headers,
        json={"fullName": "Dr. Jane Smith", "departmentId": dept_id, "specialty": "Cardiology"},
    ).get_json()["doctor"]["id"]

    client.delete(f"/api/doctors/{doctor_id}", headers=staff_headers)

    with app.app_context():
        digest = Document.query.filter_by(document_type="directory_digest").first()
        full_text = " ".join(c.text for c in Chunk.query.filter_by(document_id=digest.id).all())
        assert "Dr. Jane Smith" not in full_text


def test_digest_document_is_readable_via_documents_endpoint(client, staff_headers, auth_headers):
    client.post("/api/departments", headers=staff_headers, json={"name": "Cardiology"})

    resp = client.get("/api/documents", headers=auth_headers)
    filenames = [d["filename"] for d in resp.get_json()["documents"]]
    assert "Dentist & Department Directory.txt" in filenames
