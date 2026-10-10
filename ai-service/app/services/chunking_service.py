from __future__ import annotations

from dataclasses import dataclass

from app.services.parsing_service import ParsedDocument, ParsedSection


@dataclass
class ChunkDraft:
    chunk_index: int
    content: str
    section: str | None
    page_number: int | None
    source_locator: str | None


def chunk_document(
    parsed: ParsedDocument,
    *,
    chunk_size_chars: int,
    overlap_chars: int,
) -> list[ChunkDraft]:
    if overlap_chars >= chunk_size_chars:
        raise ValueError("Overlap must be smaller than chunk size.")
    drafts: list[ChunkDraft] = []
    for section in parsed.sections:
        pieces = _split_with_overlap(section.text.strip(), chunk_size_chars, overlap_chars)
        for piece in pieces:
            labeled = _with_section_prefix(section, piece)
            drafts.append(
                ChunkDraft(
                    chunk_index=len(drafts),
                    content=labeled,
                    section=section.heading,
                    page_number=section.page_number,
                    source_locator=section.source_locator,
                )
            )
    if not drafts:
        raise ValueError("No chunks produced from document.")
    return drafts


def _with_section_prefix(section: ParsedSection, piece: str) -> str:
    prefix_parts = []
    if section.heading:
        prefix_parts.append(f"Section: {section.heading}")
    if section.page_number is not None:
        prefix_parts.append(f"Page: {section.page_number}")
    if not prefix_parts:
        return piece
    return " | ".join(prefix_parts) + "\n" + piece


def _split_with_overlap(text: str, size: int, overlap: int) -> list[str]:
    if len(text) <= size:
        return [text]
    chunks: list[str] = []
    start = 0
    length = len(text)
    while start < length:
        end = min(start + size, length)
        if end < length:
            end = _prefer_breakpoint(text, start, end)
        piece = text[start:end].strip()
        if piece:
            chunks.append(piece)
        if end >= length:
            break
        start = max(0, end - overlap)
        # Avoid stalling when the breakpoint cannot move forward.
        if chunks and start <= length - len(chunks[-1]) and end == start:
            start = end
    return chunks


def _prefer_breakpoint(text: str, start: int, end: int) -> int:
    window = text[start:end]
    for separator in ("\n\n", "\n", ". ", " "):
        pos = window.rfind(separator)
        if pos >= size_floor(window):
            return start + pos + len(separator)
    return end


def size_floor(window: str) -> int:
    return max(0, int(len(window) * 0.4))
