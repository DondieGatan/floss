import io


def _upload(client, headers, filename, content, content_type="text/plain"):
    return client.post(
        "/api/documents",
        headers=headers,
        data={"file": (io.BytesIO(content), filename)},
        content_type="multipart/form-data",
    )


def test_staff_can_upload_txt_happy_path(client, staff_headers):
    resp = _upload(client, staff_headers, "notes.txt", b"Some plain text content to ingest.")
    assert resp.status_code == 201
    data = resp.get_json()["document"]
    assert data["filename"] == "notes.txt"
    assert data["status"] == "ready"
    assert data["documentType"] == "general"
    assert data["errorMessage"] is None
    assert data["pageCount"] == 1


def test_patient_cannot_upload(client, auth_headers):
    resp = _upload(client, auth_headers, "notes.txt", b"Some content.")
    assert resp.status_code == 403


def test_upload_requires_auth(client):
    resp = client.post("/api/documents", data={}, content_type="multipart/form-data")
    assert resp.status_code == 401


def test_upload_requires_file(client, staff_headers):
    resp = client.post("/api/documents", headers=staff_headers, data={}, content_type="multipart/form-data")
    assert resp.status_code == 400


def test_upload_rejects_disallowed_extension(client, staff_headers):
    resp = _upload(client, staff_headers, "malware.exe", b"binary data")
    assert resp.status_code == 400


def test_upload_empty_text_file_marks_failed_with_reason(client, staff_headers):
    resp = _upload(client, staff_headers, "empty.txt", b"   ")
    assert resp.status_code == 201
    data = resp.get_json()["document"]
    assert data["status"] == "failed"
    assert data["errorMessage"]


def test_upload_corrupt_pdf_marks_failed_with_reason(client, staff_headers):
    resp = _upload(client, staff_headers, "corrupt.pdf", b"this is not a real pdf file")
    assert resp.status_code == 201
    data = resp.get_json()["document"]
    assert data["status"] == "failed"
    assert data["errorMessage"]


def test_upload_oversized_file_returns_413(client, staff_headers, app):
    app.config["MAX_CONTENT_LENGTH"] = 10  # bytes, for this test only
    resp = _upload(client, staff_headers, "big.txt", b"this content is longer than ten bytes")
    assert resp.status_code == 413


def test_list_documents_is_shared_across_users(client, staff_headers, register_user):
    """The knowledge base is hospital-wide, not per-user: a document one
    staff member uploads is visible to any other authenticated user,
    patients included — the opposite of the old per-owner isolation."""
    patient_headers, _ = register_user(email="patient@example.com")
    _upload(client, staff_headers, "policy.txt", b"Visiting hours are 9am to 8pm daily.")

    resp = client.get("/api/documents", headers=patient_headers)
    assert len(resp.get_json()["documents"]) == 1
    assert resp.get_json()["documents"][0]["filename"] == "policy.txt"


def test_get_document_readable_by_any_authenticated_user(client, staff_headers, register_user):
    patient_headers, _ = register_user(email="patient@example.com")
    doc_id = _upload(client, staff_headers, "policy.txt", b"Visiting hours are 9am to 8pm daily.").get_json()[
        "document"
    ]["id"]

    resp = client.get(f"/api/documents/{doc_id}", headers=patient_headers)
    assert resp.status_code == 200
    assert resp.get_json()["document"]["filename"] == "policy.txt"


def test_get_document_requires_auth(client, staff_headers):
    doc_id = _upload(client, staff_headers, "policy.txt", b"Some content.").get_json()["document"]["id"]
    resp = client.get(f"/api/documents/{doc_id}")
    assert resp.status_code == 401


def test_get_missing_document_returns_404(client, auth_headers):
    resp = client.get("/api/documents/999999", headers=auth_headers)
    assert resp.status_code == 404


def test_patient_cannot_delete_document(client, staff_headers, auth_headers):
    doc_id = _upload(client, staff_headers, "policy.txt", b"Some content.").get_json()["document"]["id"]
    resp = client.delete(f"/api/documents/{doc_id}", headers=auth_headers)
    assert resp.status_code == 403


def test_staff_can_delete_document(client, staff_headers):
    doc_id = _upload(client, staff_headers, "policy.txt", b"Some content.").get_json()["document"]["id"]

    resp = client.delete(f"/api/documents/{doc_id}", headers=staff_headers)
    assert resp.status_code == 204

    resp = client.get(f"/api/documents/{doc_id}", headers=staff_headers)
    assert resp.status_code == 404


def test_upload_accepts_document_type(client, staff_headers):
    resp = client.post(
        "/api/documents",
        headers=staff_headers,
        data={"file": (io.BytesIO(b"Visiting hours are 9am to 8pm."), "policy.txt"), "documentType": "policy"},
        content_type="multipart/form-data",
    )
    assert resp.get_json()["document"]["documentType"] == "policy"
