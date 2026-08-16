"""
Prediction routes — ``/classify`` and ``/health``.

Mount this router in :mod:`main`::

    from routes.prediction import router
    app.include_router(router)
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, File, HTTPException, UploadFile
from schemas.prediction import (ClassificationResponse, HealthResponse,
                                Prediction)
from services.mapping_service import map_topk_to_categories
from services.model_service import get_model_service
from utils.image import validate_and_read

router = APIRouter()


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@router.get("/health", response_model=HealthResponse, tags=["ops"])
async def health() -> HealthResponse:
    """Liveness / readiness probe."""
    svc = get_model_service()
    return HealthResponse(
        status="ok",
        model_loaded=svc.is_loaded,
        model_name=svc.model_name,
    )


# ---------------------------------------------------------------------------
# Classification
# ---------------------------------------------------------------------------
@router.post(
    "/classify",
    response_model=ClassificationResponse,
    summary="Classify an insect image",
    tags=["classification"],
    responses={
        400: {"description": "Image could not be decoded"},
        413: {"description": "Image exceeds size limit"},
        415: {"description": "Unsupported media type"},
        503: {"description": "Model not ready"},
    },
)
async def classify(
    file: Annotated[UploadFile, File(description="JPEG or PNG insect photo")],
) -> ClassificationResponse:
    """
    Accept an uploaded insect photo, run inference through the timm model,
    and return predictions mapped to BugLord categories.

    Response fields
    ---------------
    - **top_prediction** — best-matching BugLord category + confidence
    - **all_predictions** — all six categories ranked by confidence
    - **raw_label** — original timm label (useful for debugging)
    """
    # Validate & read bytes
    image_bytes = await validate_and_read(file)

    # Inference
    svc = get_model_service()
    try:
        raw_preds = svc.predict(image_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    # Map raw labels → BugLord categories
    labels = [p.label for p in raw_preds]
    scores = [p.score for p in raw_preds]
    category_scores = map_topk_to_categories(labels, scores)

    # Build sorted prediction list (descending confidence)
    all_predictions = sorted(
        [
            Prediction(category=cat, confidence=round(score, 4))
            for cat, score in category_scores.items()
        ],
        key=lambda p: p.confidence,
        reverse=True,
    )

    return ClassificationResponse(
        success=True,
        top_prediction=all_predictions[0],
        all_predictions=all_predictions,
        raw_label=raw_preds[0].label if raw_preds else "unknown",
        model_name=svc.model_name,
    )
