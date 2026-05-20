# Given a set of coordinates representing 2 shapes, this function should
# check whether either shape overlaps with or contains the other shape.
# however, cases where the shapes only touch at the edges or corners 
# should not be considered as overlapping or containing.

from gramtan_generate import Shape
import numpy as np

def check_contains(shape1: Shape, shape2: Shape) -> bool:
    # Convert the coordinates of the shapes to numpy arrays
    shape1_coords = np.array(shape1.coordinates)
    shape2_coords = np.array(shape2.coordinates)

    # Check if any point of shape1 is inside shape2
    for point in shape1_coords:
        if is_point_inside_shape(point, shape2_coords):
            return True

    # Check if any point of shape2 is inside shape1
    for point in shape2_coords:
        if is_point_inside_shape(point, shape1_coords):
            return True

    # Check if shapes intersect without having any points inside each other
    for i in range(len(shape1_coords)):
        for j in range(len(shape2_coords)):
            if do_lines_intersect(shape1_coords[i], shape1_coords[(i + 1) % len(shape1_coords)],
                                    shape2_coords[j], shape2_coords[(j + 1) % len(shape2_coords)]):
                return True
    return False

def is_point_on_segment(p, a, b):
    (px, py), (ax, ay), (bx, by) = p, a, b
    cross = (px - ax) * (by - ay) - (py - ay) * (bx - ax)
    if abs(cross) > 1e-5:
        return False
    dot = (px - ax) * (bx - ax) + (py - ay) * (by - ay)
    if dot < 0:
        return False
    squared_len = (bx - ax)**2 + (by - ay)**2
    return dot <= squared_len

def is_point_inside_shape(point: np.ndarray, shape_coords: np.ndarray) -> bool:
    x, y = point
    inside = False
    n = len(shape_coords)

    for i in range(n):
        x1, y1 = shape_coords[i]
        x2, y2 = shape_coords[(i + 1) % n]

        if y1 == y2:
            continue

        # Check if point is exactly on the edge → treat as NOT inside
        if is_point_on_segment(point, (x1, y1), (x2, y2)):
            return False

        # Check if ray intersects edge
        intersects = ((y1 > y) != (y2 > y)) and \
                     (x < (x2 - x1) * (y - y1) / (y2 - y1 + 1e-12) + x1)

        if intersects:
            inside = not inside

    return inside

def orientation(a, b, c):
    val = (b[1] - a[1]) * (c[0] - b[0]) - \
          (b[0] - a[0]) * (c[1] - b[1])
    if abs(val) < 1e-5:
        return 0
    return 1 if val > 0 else 2

def do_lines_intersect(p1, p2, p3, p4):
    o1 = orientation(p1, p2, p3)
    o2 = orientation(p1, p2, p4)
    o3 = orientation(p3, p4, p1)
    o4 = orientation(p3, p4, p2)

    # General case
    if o1 != o2 and o3 != o4:
        return True

    # Special collinear cases — treat as NOT intersecting if only touching
    if o1 == 0 and is_point_on_segment(p3, p1, p2): return False
    if o2 == 0 and is_point_on_segment(p4, p1, p2): return False
    if o3 == 0 and is_point_on_segment(p1, p3, p4): return False
    if o4 == 0 and is_point_on_segment(p2, p3, p4): return False

    return False