from pydantic import BaseModel
from typing import List, Optional


class ShapePayload(BaseModel):
    name: str
    coords: List[List[float]]


class GenerateTangramRequest(BaseModel):
    shapes: Optional[List[ShapePayload]] = None
