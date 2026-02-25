"""
FastAPI server for the pokeradar ML sidecar.

Routes:
  GET  /health
  POST /embed        — batch embed titles
  POST /classify     — classify a single title against product centroids
  POST /centroid/update — recalculate centroid for a product from training data
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException

from src import centroid_store, classifier, model_loader
from src.schemas import (
    ClassifyRequest,
    ClassifyResponse,
    EmbedRequest,
    EmbedResponse,
    HealthResponse,
    UpdateCentroidRequest,
    UpdateCentroidResponse,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm up model and load centroids at startup
    logger.info("Loading SentenceTransformer model...")
    model_loader.get_model()
    logger.info("Loading product centroids from MongoDB...")
    centroid_store.load_all_centroids()
    logger.info("ML sidecar ready.")
    yield


app = FastAPI(title="pokeradar-ml", version="1.0.0", lifespan=lifespan)


@app.get("/health", response_model=HealthResponse)
def health():
    return HealthResponse(
        status="ok",
        centroidsLoaded=len(centroid_store.get_all_centroids()),
        modelReady=model_loader._model is not None,
    )


@app.post("/embed", response_model=EmbedResponse)
def embed(body: EmbedRequest):
    if not body.titles:
        raise HTTPException(status_code=400, detail="titles must not be empty")
    embeddings = model_loader.encode(body.titles)
    return EmbedResponse(embeddings=embeddings.tolist())


@app.post("/classify", response_model=ClassifyResponse)
def classify_title(body: ClassifyRequest):
    if not body.title.strip():
        raise HTTPException(status_code=400, detail="title must not be empty")
    product_id, confidence = classifier.classify(body.title)
    return ClassifyResponse(productId=product_id, confidence=confidence)


@app.post("/centroid/update", response_model=UpdateCentroidResponse)
def update_centroid(body: UpdateCentroidRequest):
    training_count = centroid_store.update_centroid(body.productId)
    if training_count is None:
        return UpdateCentroidResponse(
            productId=body.productId,
            trainingCount=0,
            updated=False,
        )
    return UpdateCentroidResponse(
        productId=body.productId,
        trainingCount=training_count,
        updated=True,
    )
