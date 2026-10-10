import json

import pytest

from app.services.parsing_service import ParseError, parse_document
from app.utils.file_validation import FileValidationError, validate_upload
from tests.conftest import make_pdf_bytes

MD = b"""# Online Return Policy

## Opened Electronics
Opened phones may be returned in 7 days.

## Clothing
Clothing may be returned in 30 days.
"""


def test_valid_markdown() -> None:
    parsed = parse_document("md", MD)
    headings = [s.heading for s in parsed.sections]
    assert "Opened Electronics" in headings
    assert "Clothing" in headings


def test_valid_txt() -> None:
    parsed = parse_document("txt", b"Return window is 14 days for books.")
    assert "14 days" in parsed.sections[0].text


def test_valid_csv() -> None:
    raw = b"sku,name,return_days\nA1,Phone,7\nB2,Shirt,30\n"
    parsed = parse_document("csv", raw)
    assert len(parsed.sections) == 2
    assert "return_days: 7" in parsed.sections[0].text
    assert parsed.sections[0].source_locator == "row 1"


def test_valid_json() -> None:
    payload = {"policy": {"region": "IN", "opened_electronics_days": 7}}
    parsed = parse_document("json", json.dumps(payload).encode())
    blob = " ".join(s.text for s in parsed.sections)
    assert "opened_electronics_days: 7" in blob
    assert "region: IN" in blob


def test_valid_pdf() -> None:
    parsed = parse_document("pdf", make_pdf_bytes("Opened mobile phones may be returned within 7 days."))
    assert parsed.sections
    assert parsed.sections[0].page_number == 1
    assert "7 days" in parsed.sections[0].text


def test_empty_files() -> None:
    with pytest.raises(FileValidationError) as exc:
        validate_upload("empty.md", b"   ", 1000)
    assert exc.value.code == "EMPTY_FILE"


def test_malformed_json() -> None:
    with pytest.raises(ParseError):
        parse_document("json", b"{not json")


def test_malformed_pdf_magic() -> None:
    with pytest.raises(FileValidationError) as exc:
        validate_upload("policy.pdf", b"this is not a pdf", 1000)
    assert exc.value.code == "MALFORMED_FILE"


def test_unsupported_extension() -> None:
    with pytest.raises(FileValidationError) as exc:
        validate_upload("virus.exe", b"MZ", 1000)
    assert exc.value.code == "UNSUPPORTED_TYPE"


def test_path_traversal_filename_is_stripped() -> None:
    validated = validate_upload("..\\..\\windows\\policy.md", b"# Title\n\nHello", 1000)
    assert validated.filename == "policy.md"
    assert "\\" not in validated.filename
