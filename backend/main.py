"""
BugLord Image-Classification API — application entrypoint.
===========================================================

Run locally::

    cd backend
    uvicorn main:app --reload --host 0.0.0.0 --port 8000

The application loads the timm model once during the lifespan startup event,
then routes requests through modular route/service layers.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.predict import router as predict_router
from services.model_service import init_model_service
from utils.config import settings

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lifespan — load the model once at startup, release at shutdown
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    logger.info("Starting up — loading model '%s' …", settings.MODEL_NAME)
    init_model_service()
    logger.info("Model ready.")
    yield
    logger.info("Shutting down.")


# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------
app = FastAPI(
    title="BugLord Classification API",
    version="1.0.0",
    description="Insect image → BugLord category classification service.",
    lifespan=lifespan,
)

# CORS — allow the React Native / Expo dev client to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
app.include_router(predict_router, prefix="/api")


@app.get("/health", tags=["ops"])
async def health() -> dict:
    """Liveness / readiness probe."""
    return {"status": "ok"}
