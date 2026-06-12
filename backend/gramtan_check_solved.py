from typing import List, Optional
import copy
import xml.etree.ElementTree as ET
import re
from collections import defaultdict

from shapely.geometry import Polygon, MultiPolygon
from shapely.ops import unary_union

from basemodels import ShapePayload
from gramtan_generate import Shape


last_tangram: dict = {
    "combined_shape": None,
    "serialized": None,
}


def serialize_shape(shape: Shape) -> dict:
    return {
        "name": shape.name,
        "coordinates": [[float(x), float(y)] for x, y in shape.coordinates],
        "exteriors": [
            [[float(x), float(y)] for x, y in ring]
            for ring in getattr(shape, "exterior_coordinates", [shape.coordinates])
        ],
        "holes": [
            [[float(x), float(y)] for x, y in ring]
            for ring in getattr(shape, "hole_coordinates", [])
        ],
    }


def build_shapes(shapes_payload: Optional[List[ShapePayload]]) -> List[Shape]:
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


def parse_svg_path(d: str) -> List[List[List[float]]]:
    """Parse SVG path d attribute into one or more closed coordinate rings."""
    tokens = re.findall(r"[MmLlHhVvZz]|-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?", d)
    paths: List[List[List[float]]] = []
    current: List[List[float]] = []
    x = y = 0.0
    command = None
    i = 0

    while i < len(tokens):
        token = tokens[i]
        if re.fullmatch(r"[A-Za-z]", token):
            command = token
            if command in ("M", "m") and current:
                paths.append(current)
                current = []
            i += 1
            continue

        if command in ("M", "L"):
            if i + 1 >= len(tokens):
                raise ValueError("SVG path contains an incomplete coordinate pair.")
            x = float(token)
            y = float(tokens[i + 1])
            current.append([x, y])
            i += 2
            continue

        if command in ("H", "h"):
            x = float(token)
            current.append([x, y])
            i += 1
            continue

        if command in ("V", "v"):
            y = float(token)
            current.append([x, y])
            i += 1
            continue

        if command in ("Z", "z"):
            if current:
                paths.append(current)
                current = []
            i += 1
            continue

        i += 1

    if current:
        paths.append(current)

    return paths


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
            path_rings = parse_svg_path(element.attrib["d"])
            for ring in path_rings:
                if ring:
                    polygons.append(ring)

    return polygons


def extract_exterior_and_holes(svg_data: str):
    """
    Extract exterior rings and hole rings from an SVG.
    Returns (exterior_polygon, holes_list)
    """
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

    # Group: find which polys are holes (contained in others)
    container_map = defaultdict(list)
    outer_polys = []

    for poly in shapely_polys:
        container = None
        for candidate in shapely_polys:
            if poly is candidate:
                continue
            if candidate.contains(poly):
                if container is None or candidate.area < container.area:
                    container = candidate
        if container is not None:
            container_map[container].append(poly)
        else:
            outer_polys.append(poly)

    # If we have nested polygons, create a single exterior with holes
    if container_map:
        if len(outer_polys) == 1:
            outer = outer_polys[0]
            holes = container_map.get(outer, [])
            return outer, holes
        else:
            # Multiple exteriors; union them
            exterior = unary_union(outer_polys)
            all_holes = []
            for outer in outer_polys:
                all_holes.extend(container_map.get(outer, []))
            return exterior, all_holes
    else:
        # No nesting; largest is exterior, rest are holes
        if len(shapely_polys) == 1:
            return shapely_polys[0], []
        largest = max(shapely_polys, key=lambda p: p.area)
        holes = [p for p in shapely_polys if p is not largest]
        return largest, holes


def check_svgs_match(placed_svg: str, expected_svg: str, tolerance: float = 0.1) -> dict:
    """
    Validate that placed pieces solve the puzzle using containment and overlap checks.

    Rules:
    1. Each placed piece must be completely contained within the exterior (with tolerance)
    2. Each placed piece must not overlap with any holes (with tolerance)
    3. Placed pieces must not overlap with each other (with tolerance)
    4. The union of placed pieces must cover the entire exterior minus holes (with tolerance)

    Returns a dict with:
        - matches: bool
        - details: str (explanation of pass/fail)
        - exterior_area: float
        - holes_area: float
        - placed_area: float
        - coverage_ratio: float (placed / expected_fill_area)
    """
    try:
        exterior, holes = extract_exterior_and_holes(expected_svg)
    except ValueError as e:
        return {
            "matches": False,
            "details": f"Failed to parse expected SVG: {e}",
        }

    placed_coords = extract_svg_polygons(placed_svg)
    placed_polys = []
    for coords in placed_coords:
        if len(coords) >= 3:
            try:
                poly = Polygon(coords)
                if poly.is_valid and poly.area > 0:
                    placed_polys.append(poly)
            except Exception:
                continue

    if not placed_polys:
        return {
            "matches": False,
            "details": "No valid placed pieces found",
        }

    exterior_area = exterior.area
    holes_area = sum(h.area for h in holes)
    expected_fill_area = exterior_area - holes_area
    placed_area = sum(p.area for p in placed_polys)

    # Rule 1: Each piece contained in exterior
    for i, piece in enumerate(placed_polys):
        if not exterior.contains(piece.buffer(-tolerance)):
            return {
                "matches": False,
                "details": f"Piece {i} extends outside puzzle exterior",
                "exterior_area": round(exterior_area, 4),
                "holes_area": round(holes_area, 4),
                "placed_area": round(placed_area, 4),
                "coverage_ratio": round(placed_area / expected_fill_area, 4) if expected_fill_area > 0 else 0,
            }

    # Rule 2: No piece overlaps with holes (only check for area overlap, not edge/point touch)
    for i, piece in enumerate(placed_polys):
        for j, hole in enumerate(holes):
            overlap_area = piece.intersection(hole).area
            if overlap_area > tolerance:
                return {
                    "matches": False,
                    "details": f"Piece {i} overlaps with hole {j} (overlap area: {round(overlap_area, 4)})",
                    "exterior_area": round(exterior_area, 4),
                    "holes_area": round(holes_area, 4),
                    "placed_area": round(placed_area, 4),
                    "coverage_ratio": round(placed_area / expected_fill_area, 4) if expected_fill_area > 0 else 0,
                }

    # Rule 3: No piece overlaps with other pieces (only check for area overlap, not edge/point touch)
    for i in range(len(placed_polys)):
        for j in range(i + 1, len(placed_polys)):
            overlap_area = placed_polys[i].intersection(placed_polys[j]).area
            if overlap_area > tolerance:
                return {
                    "matches": False,
                    "details": f"Piece {i} overlaps with piece {j} (overlap area: {round(overlap_area, 4)})",
                    "exterior_area": round(exterior_area, 4),
                    "holes_area": round(holes_area, 4),
                    "placed_area": round(placed_area, 4),
                    "coverage_ratio": round(placed_area / expected_fill_area, 4) if expected_fill_area > 0 else 0,
                }

    # Rule 4: Union of pieces covers the expected fill area
    placed_union = unary_union(placed_polys)
    uncovered = exterior.difference(placed_union)
    for hole in holes:
        uncovered = uncovered.difference(hole)

    uncovered_area = uncovered.area
    coverage_ratio = placed_area / expected_fill_area if expected_fill_area > 0 else 0

    if uncovered_area > tolerance:
        return {
            "matches": False,
            "details": f"Uncovered area: {round(uncovered_area, 4)} (ratio: {round(uncovered_area / expected_fill_area, 4)})",
            "exterior_area": round(exterior_area, 4),
            "holes_area": round(holes_area, 4),
            "placed_area": round(placed_area, 4),
            "coverage_ratio": round(coverage_ratio, 4),
        }

    return {
        "matches": True,
        "details": "All pieces contained, non-overlapping, and covering the puzzle",
        "exterior_area": round(exterior_area, 4),
        "holes_area": round(holes_area, 4),
        "placed_area": round(placed_area, 4),
        "coverage_ratio": round(coverage_ratio, 4),
    }