from typing import List, Optional
import copy
import xml.etree.ElementTree as ET
import re

from shapely.geometry import Polygon
from shapely.ops import unary_union

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

    return [Shape(item.name, item.coords) for item in shapes_payload]


def parse_polygon_points(points_str: str) -> List[List[float]]:
    """Parse SVG polygon points attribute into coordinate pairs."""
    numbers = re.findall(r"-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?", points_str)
    coords = [float(value) for value in numbers if value.strip()]

    if len(coords) < 6:
        raise ValueError("Polygon points must include at least three coordinate pairs.")
    if len(coords) % 2 != 0:
        raise ValueError("Polygon points string contains an incomplete coordinate pair.")

    return [[coords[i], coords[i + 1]] for i in range(0, len(coords), 2)]


def parse_svg_path(d: str) -> List[List[float]]:
    """Parse SVG path d attribute into coordinate pairs."""
    tokens = re.findall(r"[MmLlHhVvZz]|-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?", d)
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
            if i + 1 >= len(tokens):
                raise ValueError("SVG path contains an incomplete coordinate pair.")
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
    """Extract all polygon/path coordinate lists from an SVG string."""
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


def svg_to_union(svg_data: str) -> Polygon:
    """Parse an SVG string, extract all polygons, and union them into one shape."""
    polygon_coords = extract_svg_polygons(svg_data)

    if not polygon_coords:
        raise ValueError("SVG did not contain any supported polygon or path data")

    shapely_polys = []
    for coords in polygon_coords:
        if len(coords) >= 3:
            try:
                poly = Polygon(coords)
                if poly.is_valid and poly.area > 0:
                    shapely_polys.append(poly)
            except Exception:
                continue

    if not shapely_polys:
        raise ValueError("No valid polygons could be constructed from SVG data")

    return unary_union(shapely_polys)


def check_svgs_match(placed_svg: str, expected_svg: str, tolerance: float = 0.01) -> dict:
    """
    Compare two SVGs by unioning all polygons in each, then computing
    the symmetric difference. If neither shape has significant area
    outside the other, they match.

    Returns a dict with:
        - matches: bool
        - placed_area: float
        - expected_area: float
        - symmetric_difference_area: float
        - ratio: float (sym_diff / expected — 0.0 = perfect match)
    """
    placed_union = svg_to_union(placed_svg)
    expected_union = svg_to_union(expected_svg)

    placed_area = placed_union.area
    expected_area = expected_union.area

    if expected_area == 0:
        return {
            "matches": False,
            "placed_area": placed_area,
            "expected_area": 0,
            "symmetric_difference_area": placed_area,
            "ratio": float("inf"),
        }

    sym_diff = placed_union.symmetric_difference(expected_union)
    sym_diff_area = sym_diff.area
    ratio = sym_diff_area / expected_area

    return {
        "matches": ratio < tolerance,
        "placed_area": round(placed_area, 4),
        "expected_area": round(expected_area, 4),
        "symmetric_difference_area": round(sym_diff_area, 4),
        "ratio": round(ratio, 6),
    }