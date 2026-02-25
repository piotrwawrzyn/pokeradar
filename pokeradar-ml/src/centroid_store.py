"""
Manages ProductCentroid documents in MongoDB.
Each centroid is the mean of all confirmed training embeddings for a product.

Collection: product_centroids
Document shape:
  {
    productId: str,
    centroid: [float x 384],
    trainingCount: int,
    updatedAt: datetime,
  }
"""

import logging
from datetime import datetime, timezone
from typing import Optional

import numpy as np
from pymongo import MongoClient
from pymongo.collection import Collection

from src.config import settings
from src import model_loader

logger = logging.getLogger(__name__)

# In-memory cache: productId -> normalised centroid (np.ndarray, shape (384,))
_centroids: dict[str, np.ndarray] = {}

_client: MongoClient | None = None
_db = None


def _get_collection() -> Collection:
    global _client, _db
    if _client is None:
        _client = MongoClient(settings.MONGODB_URI)
        _db = _client[settings.MONGODB_DB]
    return _db["product_centroids"]


def _get_confirmation_collection() -> Collection:
    global _db
    if _db is None:
        _get_collection()
    return _db["matchconfirmationevents"]


def load_all_centroids() -> None:
    """Called at startup — loads all centroids from MongoDB into memory."""
    col = _get_collection()
    docs = list(col.find({}, {"productId": 1, "centroid": 1}))
    for doc in docs:
        arr = np.array(doc["centroid"], dtype=np.float32)
        norm = np.linalg.norm(arr)
        if norm > 0:
            arr = arr / norm
        _centroids[doc["productId"]] = arr
    logger.info("Loaded %d product centroids into memory", len(_centroids))


def get_all_centroids() -> dict[str, np.ndarray]:
    return _centroids


def update_centroid(product_id: str) -> Optional[int]:
    """
    Recalculates the centroid for product_id from all its MatchConfirmationEvents.
    Returns training count, or None if no training data found.
    """
    conf_col = _get_confirmation_collection()
    events = list(conf_col.find(
        {"productId": product_id, "source": {"$in": ["ADMIN_CONFIRMED", "ADMIN_CORRECTED"]}},
        {"rawTitle": 1},
    ))

    if not events:
        logger.warning("No training data found for productId=%s", product_id)
        return None

    titles = [e["rawTitle"] for e in events]
    embeddings = model_loader.encode(titles)  # shape (N, 384), already normalised

    centroid = embeddings.mean(axis=0)
    norm = np.linalg.norm(centroid)
    if norm > 0:
        centroid = centroid / norm

    training_count = len(titles)
    now = datetime.now(timezone.utc)

    # Persist to MongoDB
    col = _get_collection()
    col.update_one(
        {"productId": product_id},
        {
            "$set": {
                "centroid": centroid.tolist(),
                "trainingCount": training_count,
                "updatedAt": now,
            }
        },
        upsert=True,
    )

    # Update in-memory cache
    _centroids[product_id] = centroid
    logger.info("Updated centroid for %s — trainingCount=%d", product_id, training_count)
    return training_count
