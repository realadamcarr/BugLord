"""
Image validation helpers shared by route handlers.
"""

from __future__ import annotations

from fastapi import HTTPException, UploadFile
from utils.config import settings


async def validate_and_read(file: UploadFile) -> bytes:
    """
    Validate an uploaded image file and return its raw bytes.

    Checks:
    1. Content-type is in the allowed set (JPEG / PNG / WebP).
    2. File size does not exceed the configured limit.

    Raises
    ------
    HTTPException 415
        If the content type is not supported.
    HTTPException 413
        If the file exceeds the size limit.
    """
    if file.content_type not in settings.ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=415,
            detail=(
                f"Unsupported media type '{file.content_type}'. "
                "Upload a JPEG, PNG, or WebP image."
            ),
        )

    image_bytes: bytes = await file.read()

    if len(image_bytes) > settings.MAX_FILE_BYTES:
        max_mb = settings.MAX_FILE_BYTES // (1024 * 1024)
        raise HTTPException(
            status_code=413,
            detail=f"Image exceeds {max_mb} MB limit.",
        )

    return image_bytes
