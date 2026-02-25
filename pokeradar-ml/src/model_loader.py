"""
Loads and caches the SentenceTransformer model at module import time.
paraphrase-multilingual-MiniLM-L12-v2:
  - 118 MB, 384-dim output
  - CPU-viable (~50ms/title)
  - Handles Polish + English in the same embedding space
"""

from sentence_transformers import SentenceTransformer
import numpy as np

_MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"
_model: SentenceTransformer | None = None


def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer(_MODEL_NAME)
    return _model


def encode(texts: list[str]) -> np.ndarray:
    """Returns L2-normalised embeddings, shape (N, 384)."""
    model = get_model()
    embeddings = model.encode(texts, normalize_embeddings=True, batch_size=32)
    return embeddings
