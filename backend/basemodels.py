from pydantic import BaseModel
from typing import List, Optional


class ShapePayload(BaseModel):
    name: str
    coords: List[List[float]]


class GenerateTangramRequest(BaseModel):
    shapes: Optional[List[ShapePayload]] = None


class CheckSVGRequest(BaseModel):
    placed_svg: str
    expected_svg: str
