from pydantic import BaseModel
from typing import Optional


class EmbedRequest(BaseModel):
    titles: list[str]


class EmbedResponse(BaseModel):
    embeddings: list[list[float]]


class ClassifyRequest(BaseModel):
    title: str


class ClassifyResponse(BaseModel):
    productId: Optional[str]
    confidence: float


class UpdateCentroidRequest(BaseModel):
    productId: str


class UpdateCentroidResponse(BaseModel):
    productId: str
    trainingCount: int
    updated: bool


class HealthResponse(BaseModel):
    status: str
    centroidsLoaded: int
    modelReady: bool
