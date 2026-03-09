"""
Prediction route — ``POST /predict``.

Accepts an uploaded insect photo, validates it, runs inference through the
timm model service, maps the result to a BugLord category, and returns a
:class:`PredictionResponse` ready for the React Native client.

Mount this router in ``main.py``::

    from routes.predict import router as predict_router
    app.include_router(predict_router)
"""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, File, HTTPException, UploadFile
from schemas.prediction import PredictionResponse
from services.mapping_service import (build_prediction_result,
                                      build_top_predictions)
from services.model_service import predict_image_bytes
from utils.image import validate_and_read

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/predict",
    response_model=PredictionResponse,
    summary="Predict insect species from an uploaded image",
    tags=["prediction"],
    responses={
        400: {"description": "Image could not be decoded"},
        413: {"description": "Image exceeds size limit"},
        415: {"description": "Unsupported media type (not JPEG/PNG/WebP)"},
        503: {"description": "Model not loaded or unavailable"},
    },
)
async def predict(
    file: Annotated[UploadFile, File(description="JPEG, PNG, or WebP insect photo")],
) -> PredictionResponse:
    """
    Upload an insect photo and receive a species prediction mapped to a
    BugLord in-game category.

    **Flow**

    1. Validate content-type and file size.
    2. Run inference via ``predict_image_bytes``.
    3. Map the raw model output to a ``PredictionResult``.
    4. Return ``PredictionResponse`` with ``success=True``.
    """
    # ── 1. Validate & read ───────────────────────────────────────────
    image_bytes = await validate_and_read(file)

    # ── 2. Inference ─────────────────────────────────────────────────
    try:
        raw_preds = predict_image_bytes(image_bytes)
    except ValueError as exc:
        # Bad image data (corrupt, truncated, wrong format internally)
        logger.warning("Image decode failed: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        # Model not loaded / CUDA OOM / unexpected engine error
        logger.error("Inference error: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    # ── 3. Map to BugLord result ─────────────────────────────────────
    prediction = build_prediction_result(raw_preds)
    top_predictions = build_top_predictions(raw_preds)

    # ── 4. Apply confidence thresholds ───────────────────────────────
    #
    # The EVA-02 model classifies into ~10 000 iNat21 species.  A top-1
    # confidence of 20 %+ is a strong signal (random baseline = 0.01 %).
    # Thresholds are deliberately low compared to a 6-class head.
    #
    confidence = prediction.confidence

    #  < 0.05  → reject (practically random)
    if confidence < 0.05:
        return PredictionResponse(
            success=False,
            prediction=prediction,          # still include for debug / top-N
            top_predictions=top_predictions,
            low_confidence=True,
            message="Uncertain scan, try another image",
        )

    # 0.05–0.19 → accept with low-confidence warning
    if confidence < 0.20:
        return PredictionResponse(
            success=True,
            prediction=prediction,
            top_predictions=top_predictions,
            low_confidence=True,
            message="Low confidence — result may be inaccurate",
        )

    # >= 0.20  → normal success
    return PredictionResponse(
        success=True,
        prediction=prediction,
        top_predictions=top_predictions,
    )
