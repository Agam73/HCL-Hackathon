from app.services.chunking_service import chunk_document
from app.services.parsing_service import ParsedDocument, ParsedSection, parse_document


def test_short_document_is_single_chunk() -> None:
    parsed = parse_document("md", b"# Warranty\n\nCovered for 12 months.")
    drafts = chunk_document(parsed, chunk_size_chars=2400, overlap_chars=400)
    assert len(drafts) == 1
    assert drafts[0].section == "Warranty"
    assert "12 months" in drafts[0].content


def test_overlap_and_boundaries() -> None:
    text = ("alpha " * 80) + ("omega " * 80)
    parsed = ParsedDocument(
        title_hint="t",
        sections=[ParsedSection(heading="Body", text=text, source_locator="Body")],
    )
    drafts = chunk_document(parsed, chunk_size_chars=200, overlap_chars=40)
    assert len(drafts) >= 2
    assert drafts[0].chunk_index == 0
    assert drafts[1].chunk_index == 1
    first_tail = drafts[0].content[-40:]
    # Overlap copies characters from the previous window into the next chunk.
    assert any(token in drafts[1].content for token in first_tail.split() if token)


def test_metadata_preserved_per_section() -> None:
    parsed = ParsedDocument(
        title_hint="Policy",
        sections=[
            ParsedSection(heading="Opened Electronics", text="Seven days.", page_number=2, source_locator="page 2"),
            ParsedSection(heading="Clothing", text="Thirty days.", page_number=3, source_locator="page 3"),
        ],
    )
    drafts = chunk_document(parsed, chunk_size_chars=2400, overlap_chars=400)
    assert drafts[0].section == "Opened Electronics"
    assert drafts[0].page_number == 2
    assert drafts[1].section == "Clothing"


def test_large_document_creates_many_chunks() -> None:
    body = "Returns are allowed. " * 400
    parsed = ParsedDocument(
        title_hint="t",
        sections=[ParsedSection(heading="Returns", text=body)],
    )
    drafts = chunk_document(parsed, chunk_size_chars=300, overlap_chars=50)
    assert len(drafts) > 5
    assert {d.section for d in drafts} == {"Returns"}
