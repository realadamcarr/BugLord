"""
Prediction route — ``POST /predict``.

Accepts an uploaded insect photo, validates it, runs inference through the
timm model service, enriches the result via iNaturalist taxonomy look-up,
maps the result to a BugLord category, and returns a
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
from services.inat_service import enrich_predictions
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

    # ── 3. Enrich with iNaturalist (common names + taxonomy) ─────────
    species_names = [pred.label for pred in raw_preds]
    enrichments = await enrich_predictions(species_names)

    # ── 4. Map to BugLord result (keyword match first) ───────────────
    prediction = build_prediction_result(raw_preds)
    top_predictions = build_top_predictions(raw_preds)

    # ── 5. Apply iNat enrichment ─────────────────────────────────────
    # Override keyword-based mapping with taxonomy-based mapping when
    # iNat returned a match and the keyword map failed.
    top_label = raw_preds[0].label if raw_preds else ""
    top_enrichment = enrichments.get(top_label)

    if top_enrichment and top_enrichment.matched:
        # Fill in common name and scientific name.
        if top_enrichment.common_name:
            prediction.species_name = top_enrichment.common_name
            prediction.common_name = top_enrichment.common_name
        if top_enrichment.scientific_name:
            prediction.scientific_name = top_enrichment.scientific_name
        if top_enrichment.photo_url:
            prediction.inat_photo_url = top_enrichment.photo_url

        # If keyword-based mapping failed, use taxonomy-based mapping.
        if prediction.mapped_buglord_type is None and top_enrichment.buglord_category:
            prediction.mapped_buglord_type = top_enrichment.buglord_category
            prediction.is_in_primary_collection = True
            prediction.fallback_category = "insect"
            prediction.display_label = top_enrichment.buglord_category.title()
            logger.info(
                "iNat taxonomy override: %s → %s (via %s)",
                top_label, top_enrichment.buglord_category,
                top_enrichment.scientific_name,
            )

        # Update display label to use common name when mapped.
        if prediction.mapped_buglord_type and top_enrichment.common_name:
            prediction.display_label = top_enrichment.common_name

    # Enrich top predictions too.
    for tp in top_predictions:
        # Find matching enrichment by species name.
        for sp_name, enr in enrichments.items():
            parts = [p.strip() for p in sp_name.split(",")]
            common = parts[0].title()
            if common == tp.species_name and enr.matched:
                if enr.common_name:
                    tp.common_name = enr.common_name
                # Override mapping if keyword map missed it.
                if tp.mapped_buglord_type is None and enr.buglord_category:
                    tp.mapped_buglord_type = enr.buglord_category
                break

    # ── 6. Apply confidence thresholds ───────────────────────────────
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
