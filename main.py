from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional
import copy
import xml.etree.ElementTree as ET
import re

from gramtan_generate import Shape, shapes_list as DEFAULT_SHAPES_LIST, generate_puzzle

app = FastAPI(title="Tangram Creator API")


class ShapePayload(BaseModel):
    name: str
    coordinates: List[List[float]]


class GenerateTangramRequest(BaseModel):
    shapes: Optional[List[ShapePayload]] = None


last_tangram: dict = {
    "combined_shape": None,
    "serialized": None,
}


def serialize_shape(shape: Shape) -> dict:
    return {
        "name": shape.name,
        "coordinates": [[float(x), float(y)] for x, y in shape.coordinates],
    }


def build_shapes(shapes_payload: Optional[List[ShapePayload]]) -> List[Shape]:
    if shapes_payload is None:
        return [Shape(shape.name, shape.coordinates) for shape in copy.deepcopy(DEFAULT_SHAPES_LIST)]

    return [Shape(item.name, item.coordinates) for item in shapes_payload]


def _round_point(point: List[float], precision: int = 3) -> tuple[float, float]:
    return round(point[0], precision), round(point[1], precision)


def _points_close(p1: List[float], p2: List[float], tol: float = 1e-2) -> bool:
    return abs(p1[0] - p2[0]) <= tol and abs(p1[1] - p2[1]) <= tol


def _polygon_matches(expected: List[List[float]], actual: List[List[float]], tol: float = 1e-2) -> bool:
    if len(expected) != len(actual):
        return False

    unmatched = actual.copy()
    for pt in expected:
        found = False
        for candidate in unmatched:
            if _points_close(pt, candidate, tol):
                unmatched.remove(candidate)
                found = True
                break
        if not found:
            return False
    return True


def parse_polygon_points(points_str: str) -> List[List[float]]:
    numbers = re.findall(r"-?\d*\.?\d+", points_str)
    coords = [float(value) for value in numbers]
    return [[coords[i], coords[i + 1]] for i in range(0, len(coords), 2)]


def parse_svg_path(d: str) -> List[List[float]]:
    tokens = re.findall(r"[MmLlHhVvZz]|-?\d*\.?\d+", d)
    points: List[List[float]] = []
    x = y = 0.0
    command = None
    i = 0

    while i < len(tokens):
        token = tokens[i]
        if re.fullmatch(r"[A-Za-z]", token):
            command = token
            i += 1
            continue

        if command in ("M", "L"):
            x = float(token)
            y = float(tokens[i + 1])
            points.append([x, y])
            i += 2
            continue

        if command in ("H", "h"):
            x = float(token)
            points.append([x, y])
            i += 1
            continue

        if command in ("V", "v"):
            y = float(token)
            points.append([x, y])
            i += 1
            continue

        if command in ("Z", "z"):
            break

        i += 1

    return points


def extract_svg_polygons(svg_data: str) -> List[List[List[float]]]:
    try:
        root = ET.fromstring(svg_data)
    except ET.ParseError as exc:
        raise ValueError(f"Invalid SVG data: {exc}")

    polygons: List[List[List[float]]] = []
    for element in root.iter():
        tag = element.tag.split("}")[-1].lower()
        if tag == "polygon" and "points" in element.attrib:
            polygons.append(parse_polygon_points(element.attrib["points"]))
        elif tag == "path" and "d" in element.attrib:
            parsed_points = parse_svg_path(element.attrib["d"])
            if parsed_points:
                polygons.append(parsed_points)

    return polygons


@app.post("/generate-tangram")
def generate_tangram(request: GenerateTangramRequest):
    shapes = build_shapes(request.shapes)
    try:
        tangram = generate_puzzle(shapes, show_graph=True)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    if tangram is None:
        raise HTTPException(status_code=500, detail="Tangram generation failed")

    serialized = serialize_shape(tangram)
    last_tangram["combined_shape"] = serialized
    last_tangram["serialized"] = {
        "combined_shape": serialized,
        "original_shape_count": len(shapes),
    }

    return last_tangram["serialized"]


@app.get("/tangram")
def get_tangram():
    if last_tangram["combined_shape"] is None:
        raise HTTPException(status_code=404, detail="No tangram has been generated yet")
    return last_tangram["serialized"]


@app.get("/check-svg")
def check_svg(svg: str = Query(..., description="SVG markup to check against the last generated tangram")):
    if last_tangram["combined_shape"] is None:
        raise HTTPException(status_code=404, detail="No tangram has been generated yet")

    try:
        polygons = extract_svg_polygons(svg)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if not polygons:
        raise HTTPException(status_code=400, detail="SVG did not contain any supported polygon or path data")

    expected = last_tangram["combined_shape"]["coordinates"]
    match = any(_polygon_matches(expected, polygon) for polygon in polygons)

    return {
        "matches": match,
        "expected_coordinate_count": len(expected),
        "polygon_count": len(polygons),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000)
