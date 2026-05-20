import math
from random import choice
from random import shuffle
import gramtan_checks

import numpy as np
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon as MplPolygon


# defining the shapes class:

"""
---------------------------------------------------------------------------------------------------
IMPORTANT NOTE: the coordinates of the shape must be listed in clockwise order or stuff will break.
---------------------------------------------------------------------------------------------------
"""
class Shape:
    def __init__(self, name, coordinates):
        """
        Initialize a Shape object.

        :param name: Name of the shape (e.g., "Small Triangle", "Square").
        :param coordinates: List of (x, y) tuples representing the vertices of the shape.
        """
        self.name = name
        # Store coordinates as mutable lists so translate/rotate/reflect can modify them in place.
        self.coordinates = [list(coord) for coord in coordinates]

    def rotate(self, angle, origin=(0, 0)):
        """
        Rotate the shape by a given angle around a specified origin.

        :param angle: Angle in degrees (counterclockwise).
        :param origin: Point (x, y) to rotate around. Defaults to origin
        """
        radians = math.radians(angle)
        self.translate(-origin[0], -origin[1])
        for coord in self.coordinates:
            x_shifted = coord[0]
            y_shifted = coord[1]
            coord[0] = round(x_shifted * math.cos(radians) - y_shifted * math.sin(radians), 7)
            coord[1] = round(x_shifted * math.sin(radians) + y_shifted * math.cos(radians), 7)
        self.translate(origin[0], origin[1])

    def translate(self, x_offset, y_offset):
        """
        Translate the shape by a given offset.

        :param x_offset: Offset along the x-axis.
        :param y_offset: Offset along the y-axis.
        """
        for coord in self.coordinates:
            coord[0] += x_offset
            coord[1] += y_offset

    def reflect(self, axis='x', origin=(0, 0)):
        """
        Reflect the shape across a specified axis.

        :param axis: The axis to reflect across ('x' or 'y').
        :param origin: The point (x, y) to use as the reflection origin. 
        The shape is reflected so that the two lines connected to this point switch places
        """
        for coord in self.coordinates:
            if axis == 'x':
                coord[1] = 2 * origin[1] - coord[1]
            elif axis == 'y':
                coord[0] = 2 * origin[0] - coord[0]
            else:
                raise ValueError("Axis must be 'x' or 'y'")

    def __repr__(self):
        """
        String representation of the shape.
        """
        return f"Shape(name={self.name}, coordinates={self.coordinates})"


def reflect_shape_across_angle(shape: Shape, coordinate):
    # 1. Find index of the vertex
    try:
        idx = shape.coordinates.index(coordinate)
    except ValueError:
        raise ValueError("Coordinate must be a vertex of the shape")

    cx, cy = coordinate
    px, py = shape.coordinates[(idx - 1) % len(shape.coordinates)]
    nx, ny = shape.coordinates[(idx + 1) % len(shape.coordinates)]

    # 2. Compute edge vectors (prev→current and next→current)
    v1 = (px - cx, py - cy)
    v2 = (nx - cx, ny - cy)

    # Helper: normalize a 2D vector
    def normalize(v):
        x, y = v
        mag = math.sqrt(x*x + y*y)
        if mag == 0:
            return (0.0, 0.0)
        return (x/mag, y/mag)

    v1 = normalize(v1)
    v2 = normalize(v2)

    # 3. Compute interior bisector
    bisector = normalize((v1[0] + v2[0], v1[1] + v2[1]))

    # If degenerate (straight line), use perpendicular
    if abs(bisector[0]) < 1e-9 and abs(bisector[1]) < 1e-9:
        bisector = normalize((v1[1], -v1[0]))

    # 4. Angle of bisector relative to +x axis
    angle = math.degrees(math.atan2(bisector[1], bisector[0]))

    # 5. Rotate shape so bisector aligns with +x axis
    shape.rotate(-angle, origin=coordinate)

    # 6. Reflect across x-axis
    shape.reflect(axis='x', origin=coordinate)

    # 7. Rotate back
    shape.rotate(angle, origin=coordinate)


def check_point_on_line(point, line_start, line_end):
    # Check if the point is on the line segment defined by line_start and line_end
    cross_product = (point[1] - line_start[1]) * (line_end[0] - line_start[0]) - (point[0] - line_start[0]) * (line_end[1] - line_start[1])
    if abs(cross_product) > 1e-5:
        return False  # Not collinear

    if (point[0] < min(line_start[0], line_end[0]) or point[0] > max(line_start[0], line_end[0]) or
        point[1] < min(line_start[1], line_end[1]) or point[1] > max(line_start[1], line_end[1])):
        return False  # Point is outside the bounding box of the segment

    return True


def check_lines_align_and_touch(line1_start, line1_end, line2_start, line2_end):
    # Check if the lines are collinear
    cross_product = (line1_end[1] - line1_start[1]) * (line2_end[0] - line2_start[0]) - (line1_end[0] - line1_start[0]) * (line2_end[1] - line2_start[1])
    if abs(cross_product) > 1e-6:
        return False  # Lines are not collinear

    # Check if the lines touch each other
    if (check_point_on_line(line1_start, line2_start, line2_end) or
        check_point_on_line(line1_end, line2_start, line2_end) or
        check_point_on_line(line2_start, line1_start, line1_end) or
        check_point_on_line(line2_end, line1_start, line1_end)):
        return True  # Lines touch each other

    return False  # Lines are collinear but do not touch each other


def join_shapes(combinedShape : Shape, shapeToAdd : Shape) -> Shape:
    """
    IMPORTANT NOTE: 
    This function assumes that the shapes have already been moved into place next to each other to be joined.
    It adds shapeToAdd to combinedShape, and returns the updated combinedShape. 
    It also checks that the shapes are in a valid position to be joined together, and raises an error if they are not.
    A valid poisition is one where at least one point and at least part of an edge of shapeToAdd is touching combinedShape, but the shapes are not overlapping each other.
    If adding shapeToAdd would cause there to be a hole in combinedShape, then the function won't break, but it won't realize that either, missing out on potencial convex angles
    """

    if gramtan_checks.check_contains(combinedShape, shapeToAdd):
        raise ValueError("Shapes cannot overlap")
    
    # this part makes it so that the shapes original coordinates are not affected by the joining process
    combinedShape_coords = [list(coord) for coord in combinedShape.coordinates]
    shapeToAdd_coords = [list(coord) for coord in shapeToAdd.coordinates]
    """
    1. we find iterate through the points and edges of combinedShape, and find a point from shapeToAdd that lies on combinedShape
    2. we add the coordinate to the combinedShape coordinates list, unless it's already there beacause its a shared point
    3. we iterate through the rest of ShapeToAdd's coordinates and keep inserting the next coordinate into the combinedShape coordinates list, 
    until all the next coordinates and edges of shapeToAdd (up to the the first point added) lie on combinedShape,
    at which point we stop because the rest of shapeToAdd is already accounted for in combinedShape
    """

    doneAddingShapeToAdd = False
    for i in range(0, len(combinedShape_coords)): # iterate through the points and edges of combinedShape
        for j in range(0, len(shapeToAdd_coords)): # find a point from shapeToAdd that lies on combinedShape to start from
            if check_lines_align_and_touch(combinedShape_coords[i], combinedShape_coords[(i + 1) % len(combinedShape_coords)], shapeToAdd_coords[j], shapeToAdd_coords[(j + 1) % len(shapeToAdd_coords)]):
                startIteratingThroughShapeToAdd = True
                for k in range(0, len(combinedShape_coords)):
                    if check_lines_align_and_touch(combinedShape_coords[k], combinedShape_coords[(k + 1) % len(combinedShape_coords)], shapeToAdd_coords[(j + 1) % len(shapeToAdd_coords)], shapeToAdd_coords[(j + 2) % len(shapeToAdd_coords)]):
                        startIteratingThroughShapeToAdd = False
                        break
                if startIteratingThroughShapeToAdd:
                    insert_index_in_combinedShape = (i + 1) % len(combinedShape_coords)
                    if shapeToAdd_coords[(j + 1) % len(shapeToAdd_coords)] not in combinedShape_coords: # add the coordinate to the combinedShape coordinates list, unless it's already there beacause its a shared point
                        combinedShape_coords.insert(insert_index_in_combinedShape, shapeToAdd_coords[j])
                        insert_index_in_combinedShape += 1
                    start_index_in_shapeToAdd = (j + 1) % len(shapeToAdd_coords)
                    for m in range(0, len(shapeToAdd_coords)): # iterate through the rest of ShapeToAdd's coordinates and keep inserting the next coordinate into the combinedShape coordinates list, until all the next edges of shapeToAdd (up to the the first edge added) touch on combinedShape, at which point we stop because the rest of shapeToAdd is already accounted for in combinedShape
                        doneAddingShapeToAdd = True
                        for n in range(m, len(shapeToAdd_coords) - 1): # check if all the next coordinates and edges of shapeToAdd lie on combinedShape
                            for o in range(0, len(combinedShape_coords)):
                                if not check_lines_align_and_touch(combinedShape_coords[o], combinedShape_coords[(o + 1) % len(combinedShape_coords)], shapeToAdd_coords[(start_index_in_shapeToAdd + n) % len(shapeToAdd_coords)], shapeToAdd_coords[(start_index_in_shapeToAdd + n + 1) % len(shapeToAdd_coords)]):
                                    doneAddingShapeToAdd = False
                                    break
                            if not doneAddingShapeToAdd:
                                break
                        if doneAddingShapeToAdd: # if all the next coordinates and edges of shapeToAdd lie on combinedShape, then we stop because the rest of shapeToAdd is already accounted for in combinedShape
                            break
                        else:
                            combinedShape_coords.insert(insert_index_in_combinedShape, shapeToAdd_coords[(start_index_in_shapeToAdd + m) % len(shapeToAdd_coords)])
                            insert_index_in_combinedShape += 1
            if doneAddingShapeToAdd:
                break
        if doneAddingShapeToAdd:
            break
    
    if not doneAddingShapeToAdd:
        raise ValueError("Shapes must touch with an edge to be joined together (and at least one point of shapeToAdd must be touching combinedShape)")

    print(f"new combinedShape_coords: {combinedShape_coords}")
    new_coordinates = [list(coord) for coord in combinedShape_coords]
    return Shape(name=f"Combined Shape", coordinates=new_coordinates)


def find_convex_angles(shape : Shape) -> list[list[int, int]]:
    """
    IMPORTANT NOTE: this function assumes that the coordinates of the shape are listed in clockwise order, and that the shape is a valid tangram shape (so no holes or self intersections), otherwise it may not work correctly
    """
    convex_angles = []
    for i in range(0, len(shape.coordinates)):
        prev_coord = shape.coordinates[(i - 1) % len(shape.coordinates)]
        current_coord = shape.coordinates[i]
        next_coord = shape.coordinates[(i + 1) % len(shape.coordinates)]

        # Calculate the vectors from the current coordinate to the previous and next coordinates
        vector_to_prev = (prev_coord[0] - current_coord[0], prev_coord[1] - current_coord[1])
        vector_to_next = (next_coord[0] - current_coord[0], next_coord[1] - current_coord[1])

        # Calculate the cross product of the two vectors
        cross_product = vector_to_prev[0] * vector_to_next[1] - vector_to_prev[1] * vector_to_next[0]

        # If the cross product is negative, it's a convex angle
        if cross_product < 0:
            # Calculate the dot product
            dot_product = vector_to_prev[0] * vector_to_next[0] + vector_to_prev[1] * vector_to_next[1]
            
            # Calculate the angle in radians using atan2
            angle_radians = math.atan2(cross_product, dot_product)
            
            # Convert to degrees
            angle_degrees = math.degrees(angle_radians)
            
            # Ensure angle is in 0-360 range
            if angle_degrees < 0:
                angle_degrees += 360
            
            convex_angles.append([i, angle_degrees])

    return convex_angles


def two_points_distance(point1, point2):
    return round(math.sqrt((point1[0] - point2[0]) ** 2 + (point1[1] - point2[1]) ** 2), 3)


def edge_angle(p1, p2):
    return round(math.degrees(math.atan2(p2[1] - p1[1], p2[0] - p1[0])), 1)

"""
IMPORTANT NOTE: Once again, the functions below assume that the coordinates of the shape are listed in clockwise order
"""
def three_points_angle(point1, vertex_point, point3):
    
    shape_edge_angle = edge_angle(vertex_point, point3)
    combined_edge_angle = edge_angle(vertex_point, point1)

    angle_to_rotate = combined_edge_angle - shape_edge_angle
    """
    vector1 = (point1[0] - vertex_point[0], point1[1] - vertex_point[1])
    vector2 = (point3[0] - vertex_point[0], point3[1] - vertex_point[1])

    # Calculate the cross product of the two vectors
    cross_product = vector1[0] * vector2[1] - vector1[1] * vector2[0]
    dot_product = vector1[0] * vector2[0] + vector1[1] * vector2[1]

    # Calculate the angle using atan2
    angle_degrees = math.degrees(math.atan2(cross_product, dot_product))
    # Ensure angle is in 0-360 range
    if angle_degrees < 0:
        angle_degrees += 360
    """
    return angle_to_rotate


def sides_divisable(a, b, tol=1e-2):
    if a < tol or b < tol:
        return False
    return abs(a/b - round(a/b)) < tol or abs(b/a - round(b/a)) < tol

def generate_puzzle(shapes_list : list[Shape]) -> Shape:
    final_shapes_list = []

    # Debugging print statements added throughout the code

    # first, We'll move one shape into the final shapes list to start with
    first_shape = choice(shapes_list)
    print(f"First shape chosen: {first_shape.name}")
    final_shapes_list.append(first_shape)
    shapes_list.remove(first_shape)

    combinedShape = first_shape
    print(f"Initial combined shape coordinates: {list(combinedShape.coordinates)}")

    loop = 0
    while len(shapes_list) != 0 and loop < 50:
        loop += 1
        addedShapeThisLoop = False
        print(f"\n--- Loop {loop} ---")
        print(f"Remaining shapes: {[shape.name for shape in shapes_list]}")
        print(f"Final shapes: {[shape.name for shape in final_shapes_list]}")

        combined_shape_convex_points = find_convex_angles(combinedShape)
        print(f"Convex angles in combined shape: {combined_shape_convex_points}")

        shuffle(shapes_list) # shuffle the shapes list to add some randomness to the puzzle generation process
        convex_hole_filler_list_tier1 = []
        convex_hole_filler_list_tier2 = []
        convex_hole_filler_list_tier3 = []
        convex_hole_filler_list_tier4 = []        
        tier1_candidate_shapes = []
        tier2_candidate_shapes = []
        tier3_candidate_shapes = []


        if len(combined_shape_convex_points) != 0:
            print("Convex angles found in combined shape, can add more shapes.")
            for i in range(0, len(combined_shape_convex_points)):
                convex_point_index = combined_shape_convex_points[i][0]
                convex_point_angle = round(combined_shape_convex_points[i][1])
                print(f"\nChecking convex angle at index {convex_point_index} with angle {convex_point_angle} degrees")

                for shape in shapes_list:
                    print(f"Trying to fit shape: {shape.name}")
                    for j in range(0, len(shape.coordinates)):
                        print(f"Trying to fit vertex {shape.coordinates[j]} of shape {shape.name} to convex point {combinedShape.coordinates[convex_point_index]} of combined shape")
                        shapeAngle = round(three_points_angle(shape.coordinates[(j - 1) % len(shape.coordinates)], shape.coordinates[j], shape.coordinates[(j + 1) % len(shape.coordinates)]))
                        if shapeAngle > convex_point_angle:
                            continue
                        elif shapeAngle < convex_point_angle:
                            if shape not in convex_hole_filler_list_tier4:
                                convex_hole_filler_list_tier4.append((shape, convex_point_index, j))
                        elif shapeAngle == convex_point_angle:
                            if shape not in convex_hole_filler_list_tier3:
                                convex_hole_filler_list_tier3.append((shape, convex_point_index, j))
                            combinedShapeSide1Length = round(two_points_distance(combinedShape.coordinates[convex_point_index], combinedShape.coordinates[(convex_point_index - 1) % len(combinedShape.coordinates)]), 2)
                            combinedShapeSide2Length = round(two_points_distance(combinedShape.coordinates[convex_point_index], combinedShape.coordinates[(convex_point_index + 1) % len(combinedShape.coordinates)]), 2)
                            shapeSide1Length = round(two_points_distance(shape.coordinates[j], shape.coordinates[(j - 1) % len(shape.coordinates)]), 2)
                            shapeSide2Length = round(two_points_distance(shape.coordinates[j], shape.coordinates[(j + 1) % len(shape.coordinates)]), 2)
                            if (((sides_divisable(shapeSide1Length, combinedShapeSide1Length)) and (sides_divisable(shapeSide2Length, combinedShapeSide2Length)))) or (((sides_divisable(shapeSide2Length, combinedShapeSide1Length)) and (sides_divisable(shapeSide1Length, combinedShapeSide2Length)))):
                                if shape not in convex_hole_filler_list_tier1:
                                    convex_hole_filler_list_tier1.append((shape, convex_point_index, j))
                            elif sides_divisable(shapeSide1Length, combinedShapeSide1Length) or sides_divisable(shapeSide2Length, combinedShapeSide2Length) or sides_divisable(shapeSide2Length, combinedShapeSide1Length) or sides_divisable(shapeSide1Length, combinedShapeSide2Length):
                                if shape not in convex_hole_filler_list_tier2:
                                    convex_hole_filler_list_tier2.append((shape, convex_point_index, j))
            if len(convex_hole_filler_list_tier1) != 0:
                print("\nTier 1 candidate shapes found that perfectly fit a convex angle with matching side lengths:")
                for candidate in convex_hole_filler_list_tier1:
                    try:
                        print(f"Shape: {candidate[0].name}, Convex Point Index: {candidate[1]}, Shape Vertex Index: {candidate[2]}")
                        shape_to_join = candidate[0]
                        original = [coord[:] for coord in shape_to_join.coordinates]
                        convex_point_index = candidate[1]
                        shape_vertex_index = candidate[2]
                        shape_to_join.translate(combinedShape.coordinates[convex_point_index][0] - shape_to_join.coordinates[shape_vertex_index][0], combinedShape.coordinates[convex_point_index][1] - shape_to_join.coordinates[shape_vertex_index][1])
                        angleToRotateShape = three_points_angle(shape_to_join.coordinates[(shape_vertex_index + 1) % len(shape_to_join.coordinates)], shape_to_join.coordinates[shape_vertex_index], combinedShape.coordinates[(convex_point_index + 1) % len(combinedShape.coordinates)])
                        print(f"Current coordinates of shape to join: {shape_to_join.coordinates}")
                        print(f"Current coordinates of combined shape: {combinedShape.coordinates}")
                        print(f"Rotating shape {shape_to_join.name} by {angleToRotateShape} degrees to fit convex angle")
                        shape_to_join.rotate(angleToRotateShape, origin=combinedShape.coordinates[convex_point_index])
                        print(f"New coordinates of shape to join: {shape_to_join.coordinates}")
                        print(f"New coordinates of combined shape: {combinedShape.coordinates}")
                        distance1 = two_points_distance(shape_to_join.coordinates[shape_vertex_index], shape_to_join.coordinates[(shape_vertex_index + 1) % len(shape_to_join.coordinates)])
                        distance2 = two_points_distance(combinedShape.coordinates[convex_point_index], combinedShape.coordinates[(convex_point_index + 1) % len(combinedShape.coordinates)])
                        if not sides_divisable(distance1, distance2):
                            reflect_shape_across_angle(shape_to_join, shape_to_join.coordinates[shape_vertex_index])
                            print(f"Reflected shape {shape_to_join.name} across angle at vertex {shape_to_join.coordinates[shape_vertex_index]} to try to fit convex angle")
                            print(f"New coordinates of shape to join after reflection: {shape_to_join.coordinates}")
                        if gramtan_checks.check_contains(combinedShape, shape_to_join):
                            print(f"Shape {shape_to_join.name} overlaps with combined shape after transformation, skipping this candidate.")
                            shape_to_join.coordinates = [coord[:] for coord in original]
                            continue
                        combinedShape = join_shapes(combinedShape, shape_to_join)
                        print(f"Successfully joined shape {shape_to_join.name} to combined shape.")
                        final_shapes_list.append(shape_to_join)
                        shapes_list.remove(shape_to_join)
                        print(f"Final shapes list: {final_shapes_list}")
                        print(f"Combined shape coordinates after joining: {combinedShape.coordinates}")
                        print(f"Shapes list: {shapes_list}")
                        addedShapeThisLoop = True
                        break
                    except Exception as e:
                        print(f"Error occurred while processing candidate: {e}")
                        continue
            elif len(convex_hole_filler_list_tier2) != 0:
                print("\nTier 2 candidate shapes found that perfectly fit a convex angle but only one side length matches:")
                for candidate in convex_hole_filler_list_tier2:
                    try:
                        print(f"Shape: {candidate[0].name}, Convex Point Index: {candidate[1]}, Shape Vertex Index: {candidate[2]}")
                        shape_to_join = candidate[0]
                        original = [coord[:] for coord in shape_to_join.coordinates]
                        convex_point_index = candidate[1]
                        shape_vertex_index = candidate[2]
                        shape_to_join.translate(combinedShape.coordinates[convex_point_index][0] - shape_to_join.coordinates[shape_vertex_index][0], combinedShape.coordinates[convex_point_index][1] - shape_to_join.coordinates[shape_vertex_index][1])
                        angleToRotateShape = three_points_angle(shape_to_join.coordinates[(shape_vertex_index + 1) % len(shape_to_join.coordinates)], shape_to_join.coordinates[shape_vertex_index], combinedShape.coordinates[(convex_point_index + 1) % len(combinedShape.coordinates)])
                        print(f"Current coordinates of shape to join: {shape_to_join.coordinates}")
                        print(f"Current coordinates of combined shape: {combinedShape.coordinates}")
                        print(f"Rotating shape {shape_to_join.name} by {angleToRotateShape} degrees to fit convex angle")
                        shape_to_join.rotate(angleToRotateShape, origin=combinedShape.coordinates[convex_point_index])
                        print(f"New coordinates of shape to join: {shape_to_join.coordinates}")
                        print(f"New coordinates of combined shape: {combinedShape.coordinates}")
                        distance1 = two_points_distance(shape_to_join.coordinates[shape_vertex_index], shape_to_join.coordinates[(shape_vertex_index + 1) % len(shape_to_join.coordinates)])
                        distance2 = two_points_distance(combinedShape.coordinates[convex_point_index], combinedShape.coordinates[(convex_point_index + 1) % len(combinedShape.coordinates)])
                        distance3 = two_points_distance(shape_to_join.coordinates[shape_vertex_index], shape_to_join.coordinates[(shape_vertex_index - 1) % len(shape_to_join.coordinates)])
                        distance4 = two_points_distance(combinedShape.coordinates[convex_point_index], combinedShape.coordinates[(convex_point_index - 1) % len(combinedShape.coordinates)])
                        if not (sides_divisable(distance1, distance2) or sides_divisable(distance3, distance4)):
                            reflect_shape_across_angle(shape_to_join, shape_to_join.coordinates[shape_vertex_index])
                            print(f"Reflected shape {shape_to_join.name} across angle at vertex {shape_to_join.coordinates[shape_vertex_index]} to try to fit convex angle")
                            print(f"New coordinates of shape to join after reflection: {shape_to_join.coordinates}")
                        if gramtan_checks.check_contains(combinedShape, shape_to_join):
                            print(f"Shape {shape_to_join.name} overlaps with combined shape after transformation, skipping this candidate.")
                            shape_to_join.coordinates = [coord[:] for coord in original]
                            continue
                        combinedShape = join_shapes(combinedShape, shape_to_join)
                        print(f"Successfully joined shape {shape_to_join.name} to combined shape.")
                        final_shapes_list.append(shape_to_join)
                        shapes_list.remove(shape_to_join)
                        print(f"Final shapes list: {final_shapes_list}")
                        print(f"Combined shape coordinates after joining: {combinedShape.coordinates}")
                        print(f"Shapes list: {shapes_list}")
                        addedShapeThisLoop = True
                        break
                    except Exception as e:
                        print(f"Error occurred while processing candidate: {e}")
                        continue
            elif len(convex_hole_filler_list_tier3) != 0:
                print("\nTier 3 candidate shapes found that perfectly fit a convex angle but no side lengths match:")
                for candidate in convex_hole_filler_list_tier3:
                    try:
                        print(f"Shape: {candidate[0].name}, Convex Point Index: {candidate[1]}, Shape Vertex Index: {candidate[2]}")
                        shape_to_join = candidate[0]
                        original = [coord[:] for coord in shape_to_join.coordinates]
                        convex_point_index = candidate[1]
                        shape_vertex_index = candidate[2]
                        shape_to_join.translate(combinedShape.coordinates[convex_point_index][0] - shape_to_join.coordinates[shape_vertex_index][0], combinedShape.coordinates[convex_point_index][1] - shape_to_join.coordinates[shape_vertex_index][1])
                        angleToRotateShape = three_points_angle(shape_to_join.coordinates[(shape_vertex_index + 1) % len(shape_to_join.coordinates)], shape_to_join.coordinates[shape_vertex_index], combinedShape.coordinates[(convex_point_index + 1) % len(combinedShape.coordinates)])
                        print(f"Current coordinates of shape to join: {shape_to_join.coordinates}")
                        print(f"Current coordinates of combined shape: {combinedShape.coordinates}")
                        print(f"Rotating shape {shape_to_join.name} by {angleToRotateShape} degrees to fit convex angle")
                        shape_to_join.rotate(angleToRotateShape, origin=combinedShape.coordinates[convex_point_index])
                        print(f"New coordinates of shape to join: {shape_to_join.coordinates}")
                        print(f"New coordinates of combined shape: {combinedShape.coordinates}")
                        if gramtan_checks.check_contains(combinedShape, shape_to_join):
                            print(f"Shape {shape_to_join.name} overlaps with combined shape after transformation, skipping this candidate.")
                            reflect_shape_across_angle(shape_to_join, shape_to_join.coordinates[shape_vertex_index])
                            if gramtan_checks.check_contains(combinedShape, shape_to_join):
                                reflect_shape_across_angle(shape_to_join, shape_to_join.coordinates[shape_vertex_index])
                                shape_to_join.coordinates = [coord[:] for coord in original]
                                continue
                        combinedShape = join_shapes(combinedShape, shape_to_join)
                        print(f"Successfully joined shape {shape_to_join.name} to combined shape.")
                        final_shapes_list.append(shape_to_join)
                        shapes_list.remove(shape_to_join)
                        print(f"Final shapes list: {final_shapes_list}")
                        print(f"Combined shape coordinates after joining: {combinedShape.coordinates}")
                        print(f"Shapes list: {shapes_list}")
                        addedShapeThisLoop = True
                        break
                    except Exception as e:
                        print(f"Error occurred while processing candidate: {e}")
                        continue
            elif len(convex_hole_filler_list_tier4) != 0:
                print("\nTier 4 candidate shapes found that fit a convex angle but are smaller than the angle:")
                for candidate in convex_hole_filler_list_tier4:
                    try:
                        print(f"Shape: {candidate[0].name}, Convex Point Index: {candidate[1]}, Shape Vertex Index: {candidate[2]}")
                        shape_to_join = candidate[0]
                        original = [coord[:] for coord in shape_to_join.coordinates]
                        convex_point_index = candidate[1]
                        shape_vertex_index = candidate[2]
                        shape_to_join.translate(combinedShape.coordinates[convex_point_index][0] - shape_to_join.coordinates[shape_vertex_index][0], combinedShape.coordinates[convex_point_index][1] - shape_to_join.coordinates[shape_vertex_index][1])
                        angleToRotateShape = three_points_angle(shape_to_join.coordinates[(shape_vertex_index + 1) % len(shape_to_join.coordinates)], shape_to_join.coordinates[shape_vertex_index], combinedShape.coordinates[(convex_point_index + 1) % len(combinedShape.coordinates)])
                        print(f"Current coordinates of shape to join: {shape_to_join.coordinates}")
                        print(f"Current coordinates of combined shape: {combinedShape.coordinates}")
                        print(f"Rotating shape {shape_to_join.name} by {angleToRotateShape} degrees to fit convex angle")
                        shape_to_join.rotate(angleToRotateShape, origin=combinedShape.coordinates[convex_point_index])
                        print(f"New coordinates of shape to join: {shape_to_join.coordinates}")
                        print(f"New coordinates of combined shape: {combinedShape.coordinates}")
                        if gramtan_checks.check_contains(combinedShape, shape_to_join):
                            print(f"Shape {shape_to_join.name} overlaps with combined shape after transformation, skipping this candidate.")
                            reflect_shape_across_angle(shape_to_join, shape_to_join.coordinates[shape_vertex_index])
                            if gramtan_checks.check_contains(combinedShape, shape_to_join):
                                print(f"Shape {shape_to_join.name} overlaps with combined shape after transformation, skipping this candidate.")
                                reflect_shape_across_angle(shape_to_join, shape_to_join.coordinates[shape_vertex_index])
                                convex_point_angle = round(combined_shape_convex_points[i][1])
                                shapeAngle = round(three_points_angle(shape.coordinates[(j - 1) % len(shape.coordinates)], shape.coordinates[j], shape.coordinates[(j + 1) % len(shape.coordinates)]))
                                shape_to_join.rotate(convex_point_angle - shapeAngle, origin=combinedShape.coordinates[convex_point_index])
                                if gramtan_checks.check_contains(combinedShape, shape_to_join):
                                    print(f"Shape {shape_to_join.name} overlaps with combined shape after transformation, skipping this candidate.")
                                    reflect_shape_across_angle(shape_to_join, shape_to_join.coordinates[shape_vertex_index])
                                    if gramtan_checks.check_contains(combinedShape, shape_to_join):
                                        print(f"Shape {shape_to_join.name} overlaps with combined shape after transformation, skipping this candidate.")
                                        reflect_shape_across_angle(shape_to_join, shape_to_join.coordinates[shape_vertex_index])
                                        shape_to_join.coordinates = [coord[:] for coord in original]
                                        continue
                        combinedShape = join_shapes(combinedShape, shape_to_join)
                        print(f"Successfully joined shape {shape_to_join.name} to combined shape.")
                        final_shapes_list.append(shape_to_join)
                        shapes_list.remove(shape_to_join)
                        print(f"Final shapes list: {final_shapes_list}")
                        print(f"Combined shape coordinates after joining: {combinedShape.coordinates}")
                        print(f"Shapes list: {shapes_list}")
                        addedShapeThisLoop = True
                        break
                    except Exception as e:
                        print(f"Error occurred while processing candidate: {e}")
                        continue
        else:
            print("No convex angles found in combined shape.")
            for i in range(0, len(combinedShape.coordinates)):
                combinedShapeSideLength = round(two_points_distance(combinedShape.coordinates[i], combinedShape.coordinates[(i + 1) % len(combinedShape.coordinates)]), 2)
                for j in range(0, len(shapes_list)):
                    shape = shapes_list[j]
                    for k in range(0, len(shape.coordinates)):
                        shapeSideLength = round(two_points_distance(shape.coordinates[k], shape.coordinates[(k + 1) % len(shape.coordinates)]), 2)
                        if abs(shapeSideLength - combinedShapeSideLength) < 0.02:
                            if shape not in tier1_candidate_shapes:
                                tier1_candidate_shapes.append((shape, i, k))
                                continue
                        elif sides_divisable(shapeSideLength, combinedShapeSideLength):
                            if shape not in tier2_candidate_shapes:
                                tier2_candidate_shapes.append((shape, i, k))
                                continue
                        else:
                            if shape not in tier3_candidate_shapes:
                                tier3_candidate_shapes.append((shape, i, k))
                                continue
                if len(tier1_candidate_shapes) != 0:
                    print("\nTier 1 candidate shapes found that have a side length that perfectly matches a side of the combined shape:")
                    for candidate in tier1_candidate_shapes:
                        try:
                            print(f"Shape: {candidate[0].name}, Combined Shape Side Index: {candidate[1]}, Shape Side Index: {candidate[2]}")
                            shape_to_join = candidate[0]
                            original = [coord[:] for coord in shape_to_join.coordinates]
                            combined_shape_side_index = candidate[1]
                            shape_side_index = candidate[2]
                            shape_to_join.translate(combinedShape.coordinates[combined_shape_side_index][0] - shape_to_join.coordinates[shape_side_index][0], combinedShape.coordinates[combined_shape_side_index][1] - shape_to_join.coordinates[shape_side_index][1])
                            angleToRotateShape = three_points_angle(shape_to_join.coordinates[(shape_side_index + 1) % len(shape_to_join.coordinates)], shape_to_join.coordinates[shape_side_index], combinedShape.coordinates[(combined_shape_side_index + 1) % len(combinedShape.coordinates)])
                            print(f"Current coordinates of shape to join: {shape_to_join.coordinates}")
                            print(f"Current coordinates of combined shape: {combinedShape.coordinates}")
                            print(f"Rotating shape {shape_to_join.name} by {angleToRotateShape} degrees to fit edge")
                            shape_to_join.rotate(angleToRotateShape, origin=combinedShape.coordinates[combined_shape_side_index])
                            print(f"New coordinates of shape to join: {shape_to_join.coordinates}")
                            print(f"New coordinates of combined shape: {combinedShape.coordinates}")
                            if gramtan_checks.check_contains(combinedShape, shape_to_join):
                                print(f"Shape {shape_to_join.name} overlaps with combined shape after transformation, skipping this candidate.")
                                shape_to_join.translate(combinedShape.coordinates[combined_shape_side_index + 1][0] - combinedShape.coordinates[combined_shape_side_index][0], combinedShape.coordinates[combined_shape_side_index + 1][1] - combinedShape.coordinates[combined_shape_side_index][1])
                                shapeAngle = three_points_angle(shape_to_join.coordinates[(shape_side_index - 1) % len(shape_to_join.coordinates)], shape_to_join.coordinates[shape_side_index], shape_to_join.coordinates[(shape_side_index + 1) % len(shape_to_join.coordinates)])
                                shape_to_join.rotate(180 - shapeAngle, origin=shape_to_join.coordinates[shape_side_index])
                                reflect_shape_across_angle(shape_to_join, shape_to_join.coordinates[shape_side_index])
                                if gramtan_checks.check_contains(combinedShape, shape_to_join):
                                    print(f"Shape {shape_to_join.name} overlaps with combined shape after transformation, skipping this candidate.")
                                    reflect_shape_across_angle(shape_to_join, shape_to_join.coordinates[shape_side_index])
                                    shape_to_join.coordinates = [coord[:] for coord in original]
                                    continue
                            combinedShape = join_shapes(combinedShape, shape_to_join)
                            print(f"Successfully joined shape {shape_to_join.name} to combined shape.")
                            final_shapes_list.append(shape_to_join)
                            shapes_list.remove(shape_to_join)
                            print(f"Final shapes list: {final_shapes_list}")
                            print(f"Combined shape coordinates after joining: {combinedShape.coordinates}")
                            print(f"Shapes list: {shapes_list}")
                            addedShapeThisLoop = True
                            break
                        except Exception as e:
                            print(f"Error occurred while processing candidate: {e}")
                            continue
                if addedShapeThisLoop:
                    break
            if not addedShapeThisLoop and len(tier2_candidate_shapes) != 0:
                print("\nTier 2 candidate shapes found that have a side length that is divisible with a side of the combined shape:")
                for candidate in tier2_candidate_shapes:
                    try:
                        print(f"Shape: {candidate[0].name}, Combined Shape Side Index: {candidate[1]}, Shape Side Index: {candidate[2]}")
                        shape_to_join = candidate[0]
                        original = [coord[:] for coord in shape_to_join.coordinates]
                        combined_shape_side_index = candidate[1]
                        shape_side_index = candidate[2]
                        shape_to_join.translate(combinedShape.coordinates[combined_shape_side_index][0] - shape_to_join.coordinates[shape_side_index][0], combinedShape.coordinates[combined_shape_side_index][1] - shape_to_join.coordinates[shape_side_index][1])
                        angleToRotateShape = three_points_angle(shape_to_join.coordinates[(shape_side_index + 1) % len(shape_to_join.coordinates)], shape_to_join.coordinates[shape_side_index], combinedShape.coordinates[(combined_shape_side_index + 1) % len(combinedShape.coordinates)])
                        print(f"Current coordinates of shape to join: {shape_to_join.coordinates}")
                        print(f"Current coordinates of combined shape: {combinedShape.coordinates}")
                        print(f"Rotating shape {shape_to_join.name} by {angleToRotateShape} degrees to fit edge")
                        shape_to_join.rotate(angleToRotateShape, origin=combinedShape.coordinates[combined_shape_side_index])
                        print(f"New coordinates of shape to join: {shape_to_join.coordinates}")
                        print(f"New coordinates of combined shape: {combinedShape.coordinates}")
                        if gramtan_checks.check_contains(combinedShape, shape_to_join):
                            print(f"Shape {shape_to_join.name} overlaps with combined shape after transformation, skipping this candidate.")
                            shape_to_join.translate(combinedShape.coordinates[(combined_shape_side_index + 1) % len(combinedShape.coordinates)][0] - shape_to_join.coordinates[(shape_side_index + 1) % len(shape_to_join.coordinates)][0], combinedShape.coordinates[(combined_shape_side_index + 1) % len(combinedShape.coordinates)][1] - shape_to_join.coordinates[(shape_side_index + 1) % len(shape_to_join.coordinates)][1])
                            if gramtan_checks.check_contains(combinedShape, shape_to_join):
                                print(f"Shape {shape_to_join.name} overlaps with combined shape after transformation, skipping this candidate.")
                                shape_to_join.translate(combinedShape.coordinates[(combined_shape_side_index + 1) % len(combinedShape.coordinates)][0] - shape_to_join.coordinates[shape_side_index][0], combinedShape.coordinates[(combined_shape_side_index + 1) % len(combinedShape.coordinates)][1] - shape_to_join.coordinates[shape_side_index][1])
                                shapeAngle = three_points_angle(shape_to_join.coordinates[(shape_side_index - 1) % len(shape_to_join.coordinates)], shape_to_join.coordinates[shape_side_index], shape_to_join.coordinates[(shape_side_index + 1) % len(shape_to_join.coordinates)])
                                shape_to_join.rotate(180 - shapeAngle, origin=shape_to_join.coordinates[shape_side_index])
                                reflect_shape_across_angle(shape_to_join, shape_to_join.coordinates[shape_side_index])
                                if gramtan_checks.check_contains(combinedShape, shape_to_join):
                                    print(f"Shape {shape_to_join.name} overlaps with combined shape after transformation, skipping this candidate.")
                                    shape_to_join.translate(combinedShape.coordinates[combined_shape_side_index][0] - shape_to_join.coordinates[(shape_side_index + 1) % len(shape_to_join.coordinates)][0], combinedShape.coordinates[combined_shape_side_index][1] - shape_to_join.coordinates[(shape_side_index + 1) % len(shape_to_join.coordinates)][1])
                                    if gramtan_checks.check_contains(combinedShape, shape_to_join):
                                        reflect_shape_across_angle(shape_to_join, shape_to_join.coordinates[shape_side_index])
                                        shape_to_join.coordinates = [coord[:] for coord in original]
                                        continue
                        combinedShape = join_shapes(combinedShape, shape_to_join)
                        print(f"Successfully joined shape {shape_to_join.name} to combined shape.")
                        final_shapes_list.append(shape_to_join)
                        shapes_list.remove(shape_to_join)
                        print(f"Final shapes list: {final_shapes_list}")
                        print(f"Combined shape coordinates after joining: {combinedShape.coordinates}")
                        print(f"Shapes list: {shapes_list}")
                        addedShapeThisLoop = True
                        break
                    except Exception as e:
                        print(f"Error occurred while processing candidate: {e}")
                        continue
            if not addedShapeThisLoop and len(tier3_candidate_shapes) != 0:
                print("\nTier 3 candidate shapes found that have a side length that does not match but is not divisible with a side of the combined shape:")
                for candidate in tier3_candidate_shapes:
                    try:
                        print(f"Shape: {candidate[0].name}, Combined Shape Side Index: {candidate[1]}, Shape Side Index: {candidate[2]}")
                        shape_to_join = candidate[0]
                        original = [coord[:] for coord in shape_to_join.coordinates]
                        combined_shape_side_index = candidate[1]
                        shape_side_index = candidate[2]
                        shape_to_join.translate(combinedShape.coordinates[combined_shape_side_index][0] - shape_to_join.coordinates[shape_side_index][0], combinedShape.coordinates[combined_shape_side_index][1] - shape_to_join.coordinates[shape_side_index][1])
                        angleToRotateShape = three_points_angle(shape_to_join.coordinates[(shape_side_index + 1) % len(shape_to_join.coordinates)], shape_to_join.coordinates[shape_side_index], combinedShape.coordinates[(combined_shape_side_index + 1) % len(combinedShape.coordinates)])
                        print(f"Current coordinates of shape to join: {shape_to_join.coordinates}")
                        print(f"Current coordinates of combined shape: {combinedShape.coordinates}")
                        print(f"Rotating shape {shape_to_join.name} by {angleToRotateShape} degrees to fit edge")
                        shape_to_join.rotate(angleToRotateShape, origin=combinedShape.coordinates[combined_shape_side_index])
                        print(f"New coordinates of shape to join: {shape_to_join.coordinates}")
                        print(f"New coordinates of combined shape: {combinedShape.coordinates}")
                        if gramtan_checks.check_contains(combinedShape, shape_to_join):
                            print(f"Shape {shape_to_join.name} overlaps with combined shape after transformation, skipping this candidate.")
                            shape_to_join.translate(combinedShape.coordinates[(combined_shape_side_index + 1) % len(combinedShape.coordinates)][0] - shape_to_join.coordinates[(shape_side_index + 1) % len(shape_to_join.coordinates)][0], combinedShape.coordinates[(combined_shape_side_index + 1) % len(combinedShape.coordinates)][1] - shape_to_join.coordinates[(shape_side_index + 1) % len(shape_to_join.coordinates)][1])
                            if gramtan_checks.check_contains(combinedShape, shape_to_join):
                                print(f"Shape {shape_to_join.name} overlaps with combined shape after transformation, skipping this candidate.")
                                shape_to_join.translate(combinedShape.coordinates[(combined_shape_side_index + 1) % len(combinedShape.coordinates)][0] - shape_to_join.coordinates[shape_side_index][0], combinedShape.coordinates[(combined_shape_side_index + 1) % len(combinedShape.coordinates)][1] - shape_to_join.coordinates[shape_side_index][1])
                                shapeAngle = three_points_angle(shape_to_join.coordinates[(shape_side_index - 1) % len(shape_to_join.coordinates)], shape_to_join.coordinates[shape_side_index], shape_to_join.coordinates[(shape_side_index + 1) % len(shape_to_join.coordinates)])
                                shape_to_join.rotate(180 - shapeAngle, origin=shape_to_join.coordinates[shape_side_index])
                                reflect_shape_across_angle(shape_to_join, shape_to_join.coordinates[shape_side_index])
                                if gramtan_checks.check_contains(combinedShape, shape_to_join):
                                    print(f"Shape {shape_to_join.name} overlaps with combined shape after transformation, skipping this candidate.")
                                    shape_to_join.translate(combinedShape.coordinates[combined_shape_side_index][0] - shape_to_join.coordinates[(shape_side_index + 1) % len(shape_to_join.coordinates)][0], combinedShape.coordinates[combined_shape_side_index][1] - shape_to_join.coordinates[(shape_side_index + 1) % len(shape_to_join.coordinates)][1])
                                    if gramtan_checks.check_contains(combinedShape, shape_to_join):
                                        reflect_shape_across_angle(shape_to_join, shape_to_join.coordinates[shape_side_index])
                                        shape_to_join.coordinates = [coord[:] for coord in original]
                                        continue
                        combinedShape = join_shapes(combinedShape, shape_to_join)
                        print(f"Successfully joined shape {shape_to_join.name} to combined shape.")
                        final_shapes_list.append(shape_to_join)
                        shapes_list.remove(shape_to_join)
                        print(f"Final shapes list: {final_shapes_list}")
                        print(f"Combined shape coordinates after joining: {combinedShape.coordinates}")
                        print(f"Shapes list: {shapes_list}")
                        addedShapeThisLoop = True
                        break
                    except Exception as e:
                        print(f"Error occurred while processing candidate: {e}")
                        continue
            if not addedShapeThisLoop:
                print("No suitable candidate shapes found to fit edges of combined shape, trying to fit shapes into convex angles if they exist.")
                continue
    if len(shapes_list) == 0:
        print("All shapes successfully joined into one shape that matches the silhouette!")
        graph_everything([combinedShape], 1.0, 'black', 'Custom Tangram Puzzle Maker', loop)
        graph_everything(final_shapes_list, 0.9, 'red', 'Custom Tangram Puzzle Maker - Solved', loop)

        return combinedShape
    else:
        print("Could not find a way to join all shapes into one shape that matches the silhouette.")
        return None

def graph_everything(final_shapes_list, alpha, border, title, loops):
    plt.rcParams['figure.figsize'] = [10, 8]    # Set the figure size for better visibility
    fig, ax = plt.subplots()    # Create a figure and axis
    ax.set_facecolor('#204652')  # Change the plot area background color
    fig.patch.set_facecolor('#204652')  # Change the entire figure background color
    for shape in final_shapes_list:
        coords = np.array(shape.coordinates)    # Get the exterior coordinates of the shape
        shape = MplPolygon(coords, facecolor='black', edgecolor=border, alpha=alpha, linewidth=1)
        ax.add_patch(shape)
    ax.set_aspect('equal')    # Set equal aspect ratio so the shapes aren't distorted
    all_coords = np.vstack([np.array(shape.coordinates) for shape in final_shapes_list])
    xmin, ymin = all_coords.min(axis=0)
    xmax, ymax = all_coords.max(axis=0)
    ax.set_xlim(xmin-1, xmax+1)   # setting axis limits
    ax.set_ylim(ymin-1, ymax+1)
    ax.grid(False)    # Remove grid for better visibility
    ax.axis('off')  # Turn off the axis
    plt.title(title, color='#ff9966')
    plt.suptitle("Made with " + str(loops) + " lolololoops", fontsize=12, color="#ff9966")
    plt.show()

# Suppose the small triangle has legs of length 1 unit which we'll call 'Length_A'
LENGTH_A = 1
# The Small Triangle has a Hypotnuse of LENGTH_A * sqrt(2), which is also the leg length of the Medium Triangle
LENGTH_B = LENGTH_A * round(np.sqrt(2), 4)

shapes_list = [
    # 1. Bigger Triangle
    Shape(
        name="Bigger Triangle",
        coordinates=[(0, 0), (2 * LENGTH_B, 0), (0, 2 * LENGTH_B)]
    ),
    # 2. Big Triangle
    Shape(
        name="Big Triangle",
        coordinates=[(0, 0), (2 * LENGTH_A, 0), (0, 2 * LENGTH_A)]
    ),
    # 3. Medium Triangle
    Shape(
        name="Medium Triangle",
        coordinates=[(0, 0), (LENGTH_B, 0), (0, LENGTH_B)]
    ),
    # 4. Small Triangle 1
    Shape(
        name="Small Triangle 1",
        coordinates=[(0, 0), (LENGTH_A, 0), (0, LENGTH_A)]
    ),
    # 5. Small Triangle 2
    Shape(
        name="Small Triangle 2",
        coordinates=[(0, 0), (LENGTH_A, 0), (0, LENGTH_A)]
    ),
    # 6. Square
    Shape(
        name="Square",
        coordinates=[(0, 0), (LENGTH_A, 0), (LENGTH_A, LENGTH_A), (0, LENGTH_A)]
    ),
    # 7. Parallelogram
    Shape(
        name="Parallelogram",
        coordinates=[(0, 0), (LENGTH_A, 0), (LENGTH_A + LENGTH_A, LENGTH_A), (LENGTH_A, LENGTH_A)]
    ),
    # 8. Large Parallelogram
    Shape(
        name="Large Parallelogram",
        coordinates=[(0, 0), (LENGTH_B, 0), (LENGTH_B + LENGTH_B, LENGTH_B), (LENGTH_B, LENGTH_B)]
    ),
    # 9. Rectangle
    Shape(
        name="Rectangle",
        coordinates=[(0, 0), (LENGTH_A, 0), (LENGTH_A, 2*LENGTH_A), (0, 2*LENGTH_A)]
    ),
    # 10. Trapezoid
    Shape(
        name="Trapezoid",
        coordinates=[(0, 0), (LENGTH_A, 0), (LENGTH_A + LENGTH_A, LENGTH_A), (-LENGTH_A, LENGTH_A)]
    )
]

shape = generate_puzzle(shapes_list)
