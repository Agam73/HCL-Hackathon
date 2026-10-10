from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from fastapi import HTTPException, status

ALLOWED_EXTENSIONS = {
    ".pdf": "pdf",
    ".md": "md",
    ".markdown": "md",
    ".txt": "txt",
    ".csv": "csv",
    ".json": "json",
}

MAGIC_PREFIXES: dict[str, tuple[bytes, ...]] = {
    "pdf": (b"%PDF",),
    # Text formats are sniffed after UTF-8 decode, not by binary magic.
}


@dataclass
class ValidatedFile:
    filename: str
    file_type: str
    content: bytes


class FileValidationError(Exception):
    def __init__(self, message: str, code: str = "INVALID_FILE") -> None:
        super().__init__(message)
        self.message = message
        self.code = code


def safe_filename(raw_name: str | None) -> str:
    """Drop any path components so uploads cannot traverse directories."""
    if not raw_name:
        raise FileValidationError("A filename is required.")
    name = Path(raw_name.replace("\\", "/")).name
    if not name or name in {".", ".."}:
        raise FileValidationError("A filename is required.")
    return name


def detect_file_type(filename: str) -> str:
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise FileValidationError(
            f"Unsupported file extension '{suffix}'. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}.",
            code="UNSUPPORTED_TYPE",
        )
    return ALLOWED_EXTENSIONS[suffix]


def validate_content(file_type: str, content: bytes) -> None:
    if not content or not content.strip():
        raise FileValidationError("File is empty.", code="EMPTY_FILE")
    if file_type == "pdf":
        if not content.startswith(b"%PDF"):
            raise FileValidationError("File extension is .pdf but content is not a PDF.", code="MALFORMED_FILE")
        return
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise FileValidationError("Text files must be valid UTF-8.", code="MALFORMED_FILE") from exc
    if not text.strip():
        raise FileValidationError("File is empty.", code="EMPTY_FILE")


def validate_upload(filename: str | None, content: bytes, max_bytes: int) -> ValidatedFile:
    if len(content) > max_bytes:
        raise FileValidationError(
            f"File exceeds the maximum size of {max_bytes} bytes.",
            code="FILE_TOO_LARGE",
        )
    name = safe_filename(filename)
    file_type = detect_file_type(name)
    validate_content(file_type, content)
    return ValidatedFile(filename=name, file_type=file_type, content=content)


def http_from_validation(exc: FileValidationError) -> HTTPException:
    status_code = status.HTTP_400_BAD_REQUEST
    if exc.code == "FILE_TOO_LARGE":
        status_code = status.HTTP_413_CONTENT_TOO_LARGE
    return HTTPException(
        status_code=status_code,
        detail={"code": exc.code, "message": exc.message},
    )
