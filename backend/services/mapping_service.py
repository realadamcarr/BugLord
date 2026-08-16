"""
Mapping service — maps species names to BugLord insect categories.

Loads ``data/species_map.json`` at first use and builds a reverse lookup
from keyword → BugLord category.  Exposes two primary helpers:

- :func:`map_species_to_buglord_type` — species string → category or None.
- :func:`build_prediction_result`     — species + confidence → result dict.

Legacy helpers (:func:`map_label_to_category`, :func:`map_topk_to_categories`)
are kept for backward compatibility with existing routes.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Optional

from data.category_map import BUGLORD_CATEGORIES
from schemas.prediction import PredictionResult
from services.model_service import RawPrediction

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
_UNKNOWN_LABEL = "Unknown Bug"

# ---------------------------------------------------------------------------
# JSON-backed keyword map (loaded once, cached)
# ---------------------------------------------------------------------------
_SPECIES_MAP_PATH = Path(__file__).resolve().parent.parent / "data" / "species_map.json"

_keyword_to_category: dict[str, str] | None = None


def _load_species_map(path: Path | str = _SPECIES_MAP_PATH) -> dict[str, str]:
    """
    Read ``species_map.json`` and build a flat ``{keyword: category}`` dict.

    The JSON structure is ``{ "category": ["keyword", ...], ... }``.
    All keywords are stored lower-cased for case-insensitive matching.
    """
    global _keyword_to_category  # noqa: PLW0603

    if _keyword_to_category is not None:
        return _keyword_to_category

    path = Path(path)
    logger.info("Loading species map from %s", path)

    with path.open("r", encoding="utf-8") as fh:
        raw: dict[str, list[str]] = json.load(fh)

    _keyword_to_category = {}
    for category, keywords in raw.items():
        for kw in keywords:
            _keyword_to_category[kw.lower()] = category

    logger.info(
        "Species map ready — %d keywords across %d categories",
        len(_keyword_to_category),
        len(raw),
    )
    return _keyword_to_category


# ---------------------------------------------------------------------------
# Primary API
# ---------------------------------------------------------------------------
def map_species_to_buglord_type(species_name: str) -> Optional[str]:
    """
    Map a species name to one of the six BugLord categories.

    Performs a case-insensitive substring search against every keyword in
    ``species_map.json``.  Returns the matching category (``"bee"``,
    ``"butterfly"``, ``"beetle"``, ``"fly"``, ``"spider"``, ``"ant"``)
    or ``None`` if the species doesn't match any BugLord category.

    Parameters
    ----------
    species_name:
        Any species string — common name, scientific name, or a raw model
        label like ``"monarch, monarch butterfly, Danaus plexippus"``.
    """
    keyword_map = _load_species_map()
    name_lower = species_name.lower()

    for keyword, category in keyword_map.items():
        if keyword in name_lower:
            return category

    return None


# ---------------------------------------------------------------------------
# build_prediction_result — public dispatcher + private helpers
# ---------------------------------------------------------------------------

def _build_from_species(species_name: str, confidence: float) -> dict:
    """New API: build a plain dict from a species name and confidence."""
    parts = [p.strip() for p in species_name.split(",")]
    common_name = parts[0].title()
    scientific_name = parts[-1] if len(parts) > 1 else ""

    mapped = map_species_to_buglord_type(species_name)
    is_primary = mapped is not None

    return {
        "speciesName": common_name,
        "scientificName": scientific_name,
        "confidence": round(confidence, 4),
        "mappedBuglordType": mapped,
        "isInPrimaryCollection": is_primary,
        "fallbackCategory": "insect" if is_primary else "other-bug",
        "displayLabel": mapped.title() if is_primary else _UNKNOWN_LABEL,
    }


def _build_from_raw_preds(raw_preds: list[RawPrediction]) -> PredictionResult:
    """Legacy API: build a PredictionResult from raw model predictions."""
    if not raw_preds:
        return PredictionResult(
            species_name="Unknown",
            scientific_name="",
            confidence=0.0,
            mapped_buglord_type=None,
            is_in_primary_collection=False,
            fallback_category="other-bug",
            display_label=_UNKNOWN_LABEL,
        )

    top = raw_preds[0]

    parts = [p.strip() for p in top.label.split(",")]
    common_name = parts[0].title()
    scientific_name = parts[-1] if len(parts) > 1 else ""

    mapped = map_species_to_buglord_type(top.label)
    is_primary = mapped is not None

    # Decision tree:
    #   Found in map  → mappedBuglordType = category, fallback = "insect"
    #   Not in map    → mappedBuglordType = None,     fallback = "other-bug"
    fallback = "insect" if is_primary else "other-bug"

    return PredictionResult(
        species_name=common_name,
        scientific_name=scientific_name,
        confidence=round(top.score, 4),
        mapped_buglord_type=mapped,
        is_in_primary_collection=is_primary,
        fallback_category=fallback,
        display_label=mapped.title() if is_primary else _UNKNOWN_LABEL,
    )


def build_prediction_result(
    species_name_or_preds: str | list[RawPrediction],
    confidence: float | None = None,
) -> PredictionResult | dict:
    """
    Build a prediction result from either:

    1. **New API** — ``(species_name: str, confidence: float)`` → ``dict``
    2. **Legacy API** — ``(raw_preds: list[RawPrediction])`` → ``PredictionResult``

    New-API result dict keys
    ~~~~~~~~~~~~~~~~~~~~~~~~
    - ``speciesName``
    - ``scientificName``
    - ``confidence``
    - ``mappedBuglordType``   — one of the 6 categories, or ``None``
    - ``isInPrimaryCollection`` — ``True`` when mapped, else ``False``
    - ``fallbackCategory``    — ``"insect"`` if mapped, ``"other-bug"`` otherwise
    - ``displayLabel``        — title-cased category or ``"Unknown Bug"``
    """
    if isinstance(species_name_or_preds, str):
        return _build_from_species(species_name_or_preds, confidence or 0.0)

    return _build_from_raw_preds(species_name_or_preds)


# ---------------------------------------------------------------------------
# Top-K debugging helper
# ---------------------------------------------------------------------------
def build_top_predictions(raw_preds: list[RawPrediction]) -> list[dict]:
    """
    Convert a list of :class:`RawPrediction` into lightweight dicts
    suitable for the ``topPredictions`` debugging array.

    Each dict contains ``speciesName``, ``confidence``, and
    ``mappedBuglordType``.
    """
    items: list[dict] = []
    for pred in raw_preds:
        parts = [p.strip() for p in pred.label.split(",")]
        common_name = parts[0].title()
        mapped = map_species_to_buglord_type(pred.label)
        items.append({
            "speciesName": common_name,
            "confidence": round(pred.score, 4),
            "mappedBuglordType": mapped,
        })
    return items


# ---------------------------------------------------------------------------
# Legacy helpers (used by routes/prediction.py)
# ---------------------------------------------------------------------------
def map_label_to_category(label: str) -> str | None:
    """Alias for :func:`map_species_to_buglord_type` (backward compat)."""
    return map_species_to_buglord_type(label)


def map_topk_to_categories(
    labels: list[str],
    scores: list[float],
) -> dict[str, float]:
    """
    Aggregate top-K raw predictions into per-BugLord-category scores.

    When multiple raw labels map to the same category the **highest**
    individual score is kept.  All six categories are always present.
    """
    category_scores: dict[str, float] = dict.fromkeys(BUGLORD_CATEGORIES, 0.0)

    for label, score in zip(labels, scores):
        cat = map_species_to_buglord_type(label)
        if cat is not None and score > category_scores[cat]:
            category_scores[cat] = score

    return category_scores
