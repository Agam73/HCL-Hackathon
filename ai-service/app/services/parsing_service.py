from __future__ import annotations

import csv
import io
import json
import re
from dataclasses import dataclass, field
from typing import Callable

from pypdf import PdfReader


class ParseError(Exception):
    def __init__(self, message: str, code: str = "MALFORMED_FILE") -> None:
        super().__init__(message)
        self.message = message
        self.code = code


@dataclass
class ParsedSection:
    heading: str | None
    text: str
    page_number: int | None = None
    source_locator: str | None = None


@dataclass
class ParsedDocument:
    title_hint: str | None
    sections: list[ParsedSection] = field(default_factory=list)


def parse_pdf(content: bytes) -> ParsedDocument:
    try:
        reader = PdfReader(io.BytesIO(content))
    except Exception as exc:
        raise ParseError("Could not parse PDF.") from exc
    if reader.is_encrypted:
        raise ParseError("Encrypted PDFs are not supported.")
    sections: list[ParsedSection] = []
    for index, page in enumerate(reader.pages, start=1):
        try:
            text = (page.extract_text() or "").strip()
        except Exception as exc:
            raise ParseError(f"Could not extract text from PDF page {index}.") from exc
        if not text:
            continue
        heading = text.splitlines()[0][:120]
        sections.append(
            ParsedSection(
                heading=heading,
                text=text,
                page_number=index,
                source_locator=f"page {index}",
            )
        )
    if not sections:
        raise ParseError("PDF contained no extractable text.", code="EMPTY_FILE")
    title = None
    if reader.metadata and reader.metadata.title:
        title = str(reader.metadata.title)
    return ParsedDocument(title_hint=title, sections=sections)


_HEADING = re.compile(r"^(#{1,6})\s+(.+)$")


def parse_markdown(content: bytes) -> ParsedDocument:
    text = _decode(content)
    lines = text.splitlines()
    title = None
    sections: list[ParsedSection] = []
    current_heading = "Introduction"
    current_lines: list[str] = []

    def flush() -> None:
        body = "\n".join(current_lines).strip()
        if body:
            sections.append(
                ParsedSection(
                    heading=current_heading,
                    text=body,
                    source_locator=current_heading,
                )
            )

    for line in lines:
        match = _HEADING.match(line.strip())
        if match:
            flush()
            current_heading = match.group(2).strip()
            current_lines = []
            if title is None:
                title = current_heading
            continue
        current_lines.append(line)
    flush()
    if not sections:
        raise ParseError("Markdown file contained no text.", code="EMPTY_FILE")
    return ParsedDocument(title_hint=title, sections=sections)


def parse_txt(content: bytes) -> ParsedDocument:
    text = _decode(content).strip()
    if not text:
        raise ParseError("Text file is empty.", code="EMPTY_FILE")
    first = text.splitlines()[0][:120]
    return ParsedDocument(
        title_hint=first,
        sections=[ParsedSection(heading=first, text=text, source_locator="body")],
    )


def parse_csv(content: bytes) -> ParsedDocument:
    text = _decode(content)
    try:
        reader = csv.DictReader(io.StringIO(text))
        if not reader.fieldnames:
            raise ParseError("CSV file has no header row.", code="MALFORMED_FILE")
        rows = list(reader)
    except ParseError:
        raise
    except Exception as exc:
        raise ParseError("CSV file could not be parsed.") from exc
    if not rows:
        raise ParseError("CSV file has no data rows.", code="EMPTY_FILE")
    sections: list[ParsedSection] = []
    for index, row in enumerate(rows, start=1):
        parts = [f"{key}: {value}" for key, value in row.items() if value not in (None, "")]
        if not parts:
            continue
        body = " | ".join(parts)
        locator = f"row {index}"
        sections.append(
            ParsedSection(
                heading=locator,
                text=f"CSV {locator}. {body}",
                source_locator=locator,
            )
        )
    if not sections:
        raise ParseError("CSV file has no usable rows.", code="EMPTY_FILE")
    return ParsedDocument(title_hint="CSV data", sections=sections)


def parse_json(content: bytes) -> ParsedDocument:
    try:
        data = json.loads(_decode(content))
    except json.JSONDecodeError as exc:
        raise ParseError("JSON file is malformed.") from exc
    sections = _json_to_sections(data, path="$")
    if not sections:
        raise ParseError("JSON file contained no usable values.", code="EMPTY_FILE")
    return ParsedDocument(title_hint="JSON document", sections=sections)


def _json_to_sections(node: object, path: str) -> list[ParsedSection]:
    sections: list[ParsedSection] = []
    if isinstance(node, dict):
        scalar_parts = []
        for key, value in node.items():
            child_path = f"{path}.{key}"
            if isinstance(value, (dict, list)):
                sections.extend(_json_to_sections(value, child_path))
            else:
                scalar_parts.append(f"{key}: {value}")
        if scalar_parts:
            text = f"JSON object {path}. " + " | ".join(scalar_parts)
            sections.append(ParsedSection(heading=path, text=text, source_locator=path))
    elif isinstance(node, list):
        for index, item in enumerate(node):
            sections.extend(_json_to_sections(item, f"{path}[{index}]"))
    else:
        sections.append(
            ParsedSection(
                heading=path,
                text=f"{path}: {node}",
                source_locator=path,
            )
        )
    return sections


def _decode(content: bytes) -> str:
    try:
        return content.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise ParseError("File is not valid UTF-8.") from exc


_PARSERS: dict[str, Callable[[bytes], ParsedDocument]] = {
    "pdf": parse_pdf,
    "md": parse_markdown,
    "txt": parse_txt,
    "csv": parse_csv,
    "json": parse_json,
}


def parse_document(file_type: str, content: bytes) -> ParsedDocument:
    parser = _PARSERS.get(file_type)
    if parser is None:
        raise ParseError(f"No parser for file type '{file_type}'.", code="UNSUPPORTED_TYPE")
    return parser(content)
