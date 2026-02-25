"""
Centroid-based classifier.
classify(title) computes cosine similarity between the title embedding
and all stored product centroids, returning the best match above threshold.
"""

import logging
from typing import Optional

import numpy as np

from src import model_loader
from src import centroid_store
from src.config import settings

logger = logging.getLogger(__name__)


def classify(title: str) -> tuple[Optional[str], float]:
    """
    Returns (productId, confidence) where confidence is 0-100.
    productId is None if no centroid exceeds ML_THRESHOLD.
    """
    centroids = centroid_store.get_all_centroids()
    if not centroids:
        return None, 0.0

    embedding = model_loader.encode([title])[0]  # shape (384,), normalised

    best_id: Optional[str] = None
    best_score: float = -1.0

    for product_id, centroid in centroids.items():
        # Cosine similarity of two L2-normalised vectors = dot product
        score = float(np.dot(embedding, centroid))
        if score > best_score:
            best_score = score
            best_id = product_id

    # Convert to 0-100 range (cosine similarity is -1..1, practical range 0..1)
    confidence = max(0.0, best_score) * 100.0

    if confidence < settings.ML_THRESHOLD:
        return None, confidence

    return best_id, confidence
