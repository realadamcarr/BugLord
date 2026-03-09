"""
Centralised configuration loaded from environment variables.

Import ``settings`` anywhere to access typed config values::

    from utils.config import settings
    print(settings.MODEL_NAME)

Override at runtime with env vars prefixed ``BUGLORD_``::

    BUGLORD_MODEL=vit_base_patch16_224 uvicorn main:app
"""

from __future__ import annotations

import os


class _Settings:
    """Immutable-ish bag of configuration values."""

    # -- Model ---------------------------------------------------------------
    MODEL_NAME: str = os.getenv(
        "BUGLORD_MODEL",
        "convnext_base.fb_in22k_ft_in1k",
    )

    # -- Upload limits -------------------------------------------------------
    MAX_FILE_BYTES: int = int(os.getenv("BUGLORD_MAX_FILE_MB", "10")) * 1024 * 1024

    # -- Allowed MIME types for image uploads --------------------------------
    ALLOWED_CONTENT_TYPES: frozenset[str] = frozenset(
        {"image/jpeg", "image/png", "image/webp"}
    )

    # -- CORS ----------------------------------------------------------------
    CORS_ORIGINS: list[str] = os.getenv("BUGLORD_CORS_ORIGINS", "*").split(",")


settings = _Settings()
