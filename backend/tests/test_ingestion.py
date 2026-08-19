from app.documents.ingestion import chunk_text, chunk_pages, extract_text


def test_chunk_text_short_returns_single_chunk():
    chunks = chunk_text("This is one short sentence. Here is another.")
    assert len(chunks) == 1
    assert "short sentence" in chunks[0]


def test_chunk_text_empty_returns_no_chunks():
    assert chunk_text("") == []
    assert chunk_text("   ") == []


def test_chunk_text_respects_size_and_overlap():
    # Build a long text out of many short, distinct sentences so we can
    # check boundaries and overlap deterministically.
    sentences = [f"Sentence number {i} is here." for i in range(60)]
    text = " ".join(sentences)

    chunks = chunk_text(text, chunk_size=200, overlap=40)

    assert len(chunks) > 1
    for chunk in chunks:
        # Some slack allowed (a single sentence can push slightly over).
        assert len(chunk) <= 200 * 1.5
    # Overlap: consecutive chunks should share at least the tail/head sentence.
    first_tail_words = chunks[0].split()[-4:]
    second_head_words = chunks[1].split()[:20]
    assert any(word in second_head_words for word in first_tail_words)


def test_chunk_text_hard_splits_pathological_long_sentence():
    # No punctuation at all -> a single "sentence" longer than the chunk size.
    text = "word " * 400
    chunks = chunk_text(text, chunk_size=100, overlap=20)
    assert len(chunks) > 1
    assert all(len(c) <= 100 for c in chunks)


def test_chunk_pages_numbers_sequentially_across_pages():
    pages = [(1, "First page sentence one. First page sentence two."), (2, "Second page sentence one.")]
    chunks = chunk_pages(pages)

    assert [c["page_number"] for c in chunks] == [1, 2]
    assert [c["chunk_index"] for c in chunks] == [0, 1]


def test_extract_text_txt():
    pages, total = extract_text(b"Hello world.", "notes.txt")
    assert total == 1
    assert pages == [(1, "Hello world.")]


def test_extract_text_txt_empty_returns_no_pages():
    pages, total = extract_text(b"   ", "empty.txt")
    assert pages == []
    assert total == 1


def test_extract_text_unsupported_extension_raises():
    import pytest
    with pytest.raises(ValueError):
        extract_text(b"data", "file.docx")


def test_extract_text_pdf():
    import fitz

    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), "Hello from a real PDF page.")
    pdf_bytes = doc.tobytes()
    doc.close()

    pages, total = extract_text(pdf_bytes, "test.pdf")
    assert total == 1
    assert len(pages) == 1
    assert "Hello from a real PDF page" in pages[0][1]
