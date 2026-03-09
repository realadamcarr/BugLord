"""
Pydantic response models for the classification API.

All models in this module are consumed by the React Native BugLord client.
Keep field descriptions and examples up-to-date so FastAPI auto-generates
accurate OpenAPI docs.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Prediction detail — a single species identification result
# ---------------------------------------------------------------------------
class PredictionResult(BaseModel):
    """Full prediction output for one image, including species info and
    the mapped BugLord in-game category."""

    species_name: str = Field(
        ...,
        alias="speciesName",
        description="Common / display name returned by the model.",
        examples=["Monarch Butterfly"],
    )
    scientific_name: str = Field(
        ...,
        alias="scientificName",
        description="Binomial scientific name, if available.",
        examples=["Danaus plexippus"],
    )
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Model confidence for this prediction, 0–1.",
        examples=[0.92],
    )
    mapped_buglord_type: str | None = Field(
        default=None,
        alias="mappedBuglordType",
        description=(
            "BugLord category the species mapped to "
            "(bee, butterfly, beetle, fly, spider, ant), or null if unmapped."
        ),
        examples=["butterfly"],
    )
    is_in_primary_collection: bool = Field(
        default=False,
        alias="isInPrimaryCollection",
        description="Whether this species is part of the six core BugLord categories.",
    )
    fallback_category: str = Field(
        ...,
        alias="fallbackCategory",
        description=(
            "Category to use when mappedBuglordType is null. "
            "Derived from the closest keyword match or 'unknown'."
        ),
        examples=["beetle"],
    )
    display_label: str = Field(
        ...,
        alias="displayLabel",
        description="Human-friendly label shown in the React Native UI.",
        examples=["Monarch Butterfly (92%)"],
    )

    model_config = {"populate_by_name": True}


# ---------------------------------------------------------------------------
# Debugging — lightweight summary of each top-K prediction
# ---------------------------------------------------------------------------
class TopPredictionItem(BaseModel):
    """Minimal prediction info for a single top-K entry (debugging use)."""

    species_name: str = Field(
        ...,
        alias="speciesName",
        description="Common / display name for this prediction.",
        examples=["Monarch Butterfly"],
    )
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Model confidence for this prediction, 0–1.",
        examples=[0.92],
    )
    mapped_buglord_type: str | None = Field(
        default=None,
        alias="mappedBuglordType",
        description=(
            "BugLord category this prediction maps to, or null if unmapped."
        ),
        examples=["butterfly"],
    )

    model_config = {"populate_by_name": True}


# ---------------------------------------------------------------------------
# /predict response
# ---------------------------------------------------------------------------
class PredictionResponse(BaseModel):
    """Top-level response returned by the prediction endpoint."""

    success: bool = Field(
        default=True,
        description=(
            "True when the model produced a usable prediction "
            "(confidence >= 0.35). False when confidence is too low."
        ),
    )
    prediction: PredictionResult | None = Field(
        default=None,
        description=(
            "Best species identification result with BugLord mapping. "
            "Null when success is false (confidence < 0.35)."
        ),
    )
    top_predictions: list[TopPredictionItem] | None = Field(
        default=None,
        alias="topPredictions",
        description=(
            "Optional array of the model's top-K predictions for debugging. "
            "Only the best prediction (above) drives collection logic."
        ),
    )
    low_confidence: bool = Field(
        default=False,
        alias="lowConfidence",
        description=(
            "True when the best prediction's confidence is between 0.35 and 0.59. "
            "The client should warn the user but can still use the prediction."
        ),
    )
    message: str | None = Field(
        default=None,
        description=(
            "Human-readable status message. Present when confidence is below "
            "threshold (e.g. 'Uncertain scan, try another image')."
        ),
    )

    model_config = {"populate_by_name": True}


# ---------------------------------------------------------------------------
# Legacy / internal — kept for backward compatibility with /classify
# ---------------------------------------------------------------------------
class Prediction(BaseModel):
    """A single BugLord category with its confidence score."""

    category: str = Field(
        ...,
        description="BugLord category (bee, butterfly, beetle, fly, spider, ant).",
        examples=["butterfly"],
    )
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Model confidence for this category, 0–1.",
        examples=[0.87],
    )


class ClassificationResponse(BaseModel):
    """Top-level response returned by ``POST /classify``."""

    success: bool = Field(
        default=True,
        description="Whether classification completed without error.",
    )
    top_prediction: Prediction = Field(
        ...,
        description="Highest-confidence BugLord category.",
    )
    all_predictions: list[Prediction] = Field(
        default_factory=list,
        description="All six BugLord categories ranked by descending confidence.",
    )
    raw_label: str = Field(
        ...,
        description="Original label returned by the timm model before mapping.",
        examples=["monarch, monarch butterfly, Danaus plexippus"],
    )
    model_name: str = Field(
        ...,
        description="Timm model identifier used for inference.",
        examples=["convnext_base.fb_in22k_ft_in1k"],
    )


# ---------------------------------------------------------------------------
# /health response
# ---------------------------------------------------------------------------
class HealthResponse(BaseModel):
    """Liveness / readiness probe payload."""

    status: str = Field(default="ok")
    model_loaded: bool
    model_name: str
