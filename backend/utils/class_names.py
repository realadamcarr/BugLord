"""
Utility for loading class-index → species-name mappings from a JSON file.

Usage::

    from utils.class_names import get_species_name

    name = get_species_name(42)   # "Apis mellifera" or "Unknown Species"
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

_DEFAULT_PATH = Path(__file__).resolve().parent.parent / "data" / "class_names.json"

_class_names: dict[int, str] | None = None


def load_class_names(path: Path | str = _DEFAULT_PATH) -> dict[int, str]:
    """
    Read a JSON file that maps string class indices to species names
    and return a ``{int: str}`` dictionary.

    The file is read once and cached in a module-level variable so
    subsequent calls are free.

    Parameters
    ----------
    path:
        Path to the JSON file.  Defaults to ``data/class_names.json``
        relative to the backend root.

    Returns
    -------
    dict[int, str]
        Mapping from integer class index to species name.

    Raises
    ------
    FileNotFoundError
        If the JSON file does not exist at *path*.
    json.JSONDecodeError
        If the file contains invalid JSON.
    """
    global _class_names  # noqa: PLW0603

    if _class_names is not None:
        return _class_names

    path = Path(path)
    logger.info("Loading class names from %s", path)

    with path.open("r", encoding="utf-8") as fh:
        raw: dict[str, str] = json.load(fh)

    _class_names = {int(k): v for k, v in raw.items()}
    logger.info("Loaded %d class names", len(_class_names))
    return _class_names


def get_species_name(class_index: int) -> str:
    """
    Return the species name for *class_index*, or ``"Unknown Species"``
    if the index is not found in the mapping.

    On first call the JSON file is loaded automatically.
    """
    names = load_class_names()
    return names.get(class_index, "Unknown Species")
