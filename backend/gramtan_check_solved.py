from typing import List, Optional
import copy
import xml.etree.ElementTree as ET
import re

from basemodels import ShapePayload
from gramtan_generate import Shape, DEFAULT_SHAPES_LIST


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
