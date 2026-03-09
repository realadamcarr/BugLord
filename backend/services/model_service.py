"""
Model service — loads a timm HuggingFace model and runs inference.

Uses ``eva02_large_patch14_clip_336.merged2b_ft_inat21`` (iNaturalist-2021
fine-tune) via the ``hf-hub:`` prefix so timm pulls it from HuggingFace.
The model is loaded **once** at module startup via :func:`load_model` and
kept in module-level globals for zero-overhead reuse.

Public API
----------
- :func:`load_model`           – download & initialise (called by lifespan).
- :func:`preprocess_image`     – bytes → batched tensor.
- :func:`predict_image_bytes`  – end-to-end convenience (bytes → top-5).
- :func:`get_model_service`    – returns the :class:`ModelService` singleton.
- :func:`init_model_service`   – creates + loads the singleton.
- :class:`RawPrediction`       – ``(label, score)`` named tuple.
"""

from __future__ import annotations

import io
import logging
from typing import NamedTuple

import timm
import torch
import torchvision.transforms.functional as F
from PIL import Image

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
# HuggingFace-hosted EVA-02 Large, fine-tuned on iNaturalist-2021 (10k classes)
MODEL_ID: str = "hf-hub:timm/eva02_large_patch14_clip_336.merged2b_ft_inat21"
TOP_K_DEFAULT: int = 5

# Preprocessing constants for the CLIP-based EVA-02 model
IMAGE_SIZE: int = 336
NORMALIZE_MEAN: tuple[float, float, float] = (0.48145466, 0.4578275, 0.40821073)
NORMALIZE_STD: tuple[float, float, float] = (0.26862954, 0.26130258, 0.27577711)

# ---------------------------------------------------------------------------
# Module-level singletons (populated by load_model)
# ---------------------------------------------------------------------------
_model: torch.nn.Module | None = None
_labels: list[str] = []
_device: torch.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")


# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------
class RawPrediction(NamedTuple):
    """A single raw model prediction before BugLord category mapping."""

    label: str
    score: float


# ---------------------------------------------------------------------------
# 1. load_model — called once at startup
# ---------------------------------------------------------------------------
def load_model(model_id: str = MODEL_ID) -> None:
    """
    Download (first run only) and load the timm model into eval mode.

    Sets module-level ``_model``, ``_transform``, and ``_labels`` so that
    :func:`preprocess_image` and :func:`predict_image_bytes` can operate
    without any per-request overhead.

    Parameters
    ----------
    model_id:
        A timm model identifier.  Defaults to the iNat21 EVA-02 checkpoint
        hosted on HuggingFace.
    """
    global _model, _labels  # noqa: PLW0603

    logger.info("Loading model '%s' on %s …", model_id, _device)

    # Create model in eval mode on the target device
    _model = timm.create_model(model_id, pretrained=True).to(_device).eval()

    # Extract human-readable class labels shipped with the checkpoint
    _labels = _model.pretrained_cfg.get("label_names", [])
    if not _labels:
        # Fallback: try the timm ImageNetInfo helper (works for IN-1k models)
        try:
            from timm.data import ImageNetInfo

            info = ImageNetInfo()
            _labels = [info.label_names[i] for i in range(info.num_classes())]
        except Exception:  # noqa: BLE001
            # Last resort: use numeric indices as labels
            _labels = [str(i) for i in range(_model.num_classes)]

    logger.info(
        "Model ready — %d classes, input size %dx%d, device %s",
        len(_labels),
        IMAGE_SIZE,
        IMAGE_SIZE,
        _device,
    )


def is_model_loaded() -> bool:
    """Return ``True`` when the model is ready for inference."""
    return _model is not None


# ---------------------------------------------------------------------------
# 2. preprocess_image — bytes → tensor
# ---------------------------------------------------------------------------
def preprocess_image(image_bytes: bytes) -> torch.Tensor:
    """
    Decode raw image bytes and prepare a tensor for model inference.

    Steps:
        1. Open with Pillow and convert to RGB.
        2. Resize to ``IMAGE_SIZE x IMAGE_SIZE`` (336x336).
        3. Convert to a float tensor in [0, 1].
        4. Normalize with ``NORMALIZE_MEAN`` / ``NORMALIZE_STD``.
        5. Add a leading batch dimension.

    Parameters
    ----------
    image_bytes:
        Raw JPEG / PNG / WebP bytes as received from the upload endpoint.

    Returns
    -------
    torch.Tensor
        Batched tensor of shape ``(1, C, H, W)`` on the target device,
        normalised and ready for a forward pass.

    Raises
    ------
    ValueError
        If the image cannot be decoded by Pillow.
    RuntimeError
        If the model has not been loaded yet.
    """
    if _model is None:
        raise RuntimeError("Model not loaded — call load_model() first.")

    # 1. Decode bytes → PIL Image (RGB)
    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as exc:
        raise ValueError(f"Could not decode image: {exc}") from exc

    # 2. Resize to the model's expected input resolution
    image = F.resize(image, [IMAGE_SIZE, IMAGE_SIZE])

    # 3. Convert PIL → float tensor (C, H, W) with values in [0, 1]
    tensor = F.to_tensor(image)

    # 4. Normalize channels with CLIP mean / std
    tensor = F.normalize(
        tensor,
        mean=list(NORMALIZE_MEAN),
        std=list(NORMALIZE_STD),
    )

    # 5. Add batch dimension → (1, C, H, W) and move to device
    tensor = tensor.unsqueeze(0).to(_device)
    return tensor


# ---------------------------------------------------------------------------
# 3. predict_image_bytes — end-to-end convenience
# ---------------------------------------------------------------------------
@torch.inference_mode()
def predict_image_bytes(
    image_bytes: bytes,
    top_k: int = TOP_K_DEFAULT,
) -> list[RawPrediction]:
    """
    Run full inference on raw image bytes and return the top-K predictions.

    Combines :func:`preprocess_image` with a forward pass and softmax to
    produce a ranked list of ``(label, confidence)`` tuples.

    Parameters
    ----------
    image_bytes:
        Raw JPEG / PNG / WebP image bytes.
    top_k:
        Number of top predictions to return (default 5).

    Returns
    -------
    list[RawPrediction]
        Top-K predictions sorted by descending confidence.

    Raises
    ------
    RuntimeError
        If the model has not been loaded yet.
    ValueError
        If the image cannot be decoded.
    """
    if _model is None:
        raise RuntimeError("Model not loaded — call load_model() first.")

    # Pre-process
    tensor = preprocess_image(image_bytes)

    # Forward pass
    logits: torch.Tensor = _model(tensor)
    probs = logits.softmax(dim=-1).squeeze(0)

    # Extract top-K indices and scores
    k = min(top_k, probs.size(0))
    values, indices = probs.topk(k)

    results: list[RawPrediction] = []
    for score_t, idx_t in zip(values, indices):
        idx = idx_t.item()
        label = _labels[idx] if idx < len(_labels) else str(idx)
        results.append(RawPrediction(label=label, score=round(float(score_t), 6)))

    return results


# ---------------------------------------------------------------------------
# ModelService wrapper — preserves the existing singleton API expected by
# routes/prediction.py and main.py (init_model_service / get_model_service).
# ---------------------------------------------------------------------------
class ModelService:
    """Thin object façade around the module-level model functions."""

    def __init__(self, model_name: str = MODEL_ID) -> None:
        self.model_name = model_name
        self.device = _device

    def load(self) -> None:
        load_model(self.model_name)

    @property
    def is_loaded(self) -> bool:
        return is_model_loaded()

    def predict(self, image_bytes: bytes, top_k: int = TOP_K_DEFAULT) -> list[RawPrediction]:
        return predict_image_bytes(image_bytes, top_k=top_k)


_service: ModelService | None = None


def init_model_service(model_name: str | None = None) -> ModelService:
    """Create, load, and cache the global :class:`ModelService`."""
    global _service  # noqa: PLW0603
    _service = ModelService(model_name=model_name or MODEL_ID)
    _service.load()
    return _service


def get_model_service() -> ModelService:
    """Return the shared :class:`ModelService`, or raise if not initialised."""
    if _service is None:
        raise RuntimeError("ModelService not initialised — server still starting?")
    return _service
