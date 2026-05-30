import math
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon as MplPolygon
from shapely.geometry import Polygon, Point, MultiPolygon
from shapely.affinity import rotate, translate, scale
from shapely.ops import snap
from random import choice, shuffle
import copy


# New idea


# These are my 10 shapes:
# 1. Bigger Triangle (1 piece)
# 2. Big Triangle (1 piece)
# 3. Medium Triangle (1 piece)  
# 4. Small Triangles (2 pieces)
# 5. Square (1 piece)
# 6. Parallelogram (1 piece)
# 7. Large Parallelogram (1 piece)
# 8. Rectangle (1 piece)
# 9. Trapezoid (1 piece)

# All the angles in the shapes are either 45 or 90 degrees or 135 degrees, so all the triangles are isosceles right triangles
# Each shape is related to the other by its dimensions:
# The small triangle is the smallest unit, and the other shapes can be made putting a bunch of those together

# Suppose the small triangle has legs of length 1 unit which we'll call 'Length_A'
LENGTH_A = 1
# The Small Triangle has a Hypotnuse of LENGTH_A * sqrt(2), which is also the leg length of the Medium Triangle
LENGTH_B = LENGTH_A * round(np.sqrt(2), 5)
# The Medium Triangle has a Hypotnuse of LENGTH_B * sqrt(2), which is also the leg length of the Big Triangle
LENGTH_C = LENGTH_B * round(np.sqrt(2), 5)
# The Big Triangle has a Hypotnuse of LENGTH_C * sqrt(2), which is also the leg length of the Bigger Triangle
LENGTH_D = LENGTH_C * round(np.sqrt(2), 5)
# The Big Triangle has a Hypotnuse of LENGTH_D * sqrt(2)
LENGTH_E = LENGTH_D * round(np.sqrt(2), 5)
# The Square has sides of Length_A
# The Parallelogram has sides of LENGTH_A and LENGTH_B
# The Large Parallelogram has sides of LENGTH_B and LENGTH_C
# The Rectangle has sides of LENGTH_A and LENGTH_C
# The Trapezoid has sides of LENGTH_A, LENGTH_B, and 3 * LENGTH_A

# Note that LENGTH_C = 2 * LENGTH_A, and LENGTH_D = 2 * LENGTH_B, that'll be important later.


# The main Idea! I have is to join shapes that have common sides together, 
# or to split longer sides into smaller lengths and have them share those sides with smaller shapes

# The more sides that are shared between shapes, the harder it is to solve the tangram puzzle
# So ideally, we want to maximize the number of shared sides between shapes

# First, though, We'll just make the program so that it can place shapes to share sides and not overlap,
# Later, we can work on optimizing the number of shared sides



# this'll graph the shapes once we have them all placed
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
    plt.suptitle("Made with " + str(loops) + " loops", fontsize=12, color="#ff9966")
    plt.show()

# defining the shapes class:
class Shape:
    def __init__(self, name, coordinates):
        """
        Initialize a Shape object.

        :param name: Name of the shape (e.g., "Small Triangle", "Square").
        :param coordinates: List of (x, y) tuples representing the vertices of the shape.
        """
        self.name = name
        self.coordinates = coordinates
        self.polygon = Polygon(coordinates)  # Create a Shapely Polygon from the coordinates

    def scale(self, x_factor, y_factor, origin='center'):
        """
        Scale the shape by given factors along x and y axes.

        :param x_factor: Scaling factor along the x-axis.
        :param y_factor: Scaling factor along the y-axis.
        :param origin: Point (x, y) to scale around.
        """
        self.polygon = scale(self.polygon, xfact=x_factor, yfact=y_factor, origin='center')
        self.coordinates = list(self.polygon.exterior.coords)[:-1]  # Update coordinates
    
    def scaled(self, x_factor, y_factor, origin='center'):
        """
        Return a new scaled Shape by given factors along x and y axes.

        :param x_factor: Scaling factor along the x-axis.
        :param y_factor: Scaling factor along the y-axis.
        :param origin: Point (x, y) to scale around.
        :return: A new scaled Shape object.
        """
        scaled_polygon = scale(self.polygon, xfact=x_factor, yfact=y_factor, origin='center')
        scaled_coordinates = list(scaled_polygon.exterior.coords)[:-1]  # Get new coordinates
        return Shape(self.name, scaled_coordinates)

    def rotate(self, angle, origin=(0, 0)):
        """
        Rotate the shape by a given angle around a specified origin.

        :param angle: Angle in degrees (counterclockwise).
        :param origin: Point (x, y) to rotate around.
        """
        self.polygon = rotate(self.polygon, angle, origin=origin)
        self.coordinates = list(self.polygon.exterior.coords)[:-1]  # Update coordinates

    def translate(self, x_offset, y_offset):
        """
        Translate the shape by a given offset.

        :param x_offset: Offset along the x-axis.
        :param y_offset: Offset along the y-axis.
        """
        self.polygon = translate(self.polygon, xoff=x_offset, yoff=y_offset)
        self.coordinates = list(self.polygon.exterior.coords)[:-1]  # Update coordinates

    def reflect(self, axis='x', origin=(0, 0)):
        """
        Reflect the shape across a specified axis.

        :param axis: The axis to reflect across ('x' or 'y').
        :param origin: The point (x, y) to use as the reflection origin.
        """
        if axis == 'x':
            self.polygon = scale(self.polygon, xfact=1, yfact=-1, origin=origin)
        elif axis == 'y':
            self.polygon = scale(self.polygon, xfact=-1, yfact=1, origin=origin)
        else:
            raise ValueError("Axis must be 'x' or 'y'")
        self.coordinates = list(self.polygon.exterior.coords)[:-1]  # Update coordinates

    def overlaps(self, other_shape, tolerance=1.0):
        """
        Check if this shape overlaps with another shape.

        :param other_shape: Another Shape object.
        :return: True if the shapes overlap, False otherwise (This includes when one shape contains the other).
        """
        if not isinstance(other_shape, Shape):
            raise ValueError("Argument must be a Shape object.")
        if tolerance > 1 or tolerance < 0:
            raise ValueError("Tolerance must be between 0 and 1.")       
        
        tolerance_shape = other_shape.scaled(tolerance, tolerance, origin='center')
        return self.polygon.overlaps(tolerance_shape.polygon)

    def contains(self, other):
        """
        Check if this shape completely contains another shape or a point.

        :param other: Another Shape object or a tuple (x, y) representing a point.
        :return: True if this shape contains the other shape or point, False otherwise.
        """
        if isinstance(other, Shape):
            return self.polygon.contains(other.polygon)
        elif isinstance(other, Point):
            return self.polygon.contains(other)  # Directly use the Point object
        elif isinstance(other, tuple) and len(other) == 2:
            return self.polygon.contains(Point(other))
        else:
            raise ValueError("Argument must be a Shape object or a tuple representing a point.")

    def __repr__(self):
        """
        String representation of the shape.
        """
        return f"Shape(name={self.name}, coordinates={self.coordinates})"
    
# Define the 10 shapes

# RULES FOR MAKING SHAPES
# 1. All Interior angles are either 45, 90, or 135 degrees
# 2. All side Length should be divisable by Length_A or be Length_B
# 3. All shapes should be polygons (no holes or curves)
# 4. All shapes should be at least (the largest side length divided by 10) thick at their midpoints

DEFAULT_SHAPES_LIST = [
    # 1. Bigger Triangle
    Shape(
        name="Bigger Triangle",
        coordinates=[(0, 0), (LENGTH_D, 0), (0, LENGTH_D)]
    ),
    # 2. Big Triangle
    Shape(
        name="Big Triangle",
        coordinates=[(0, 0), (LENGTH_C, 0), (0, LENGTH_C)]
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
        coordinates=[(0, 0), (LENGTH_A, 0), (LENGTH_A, LENGTH_C), (0, LENGTH_C)]
    ),
    # 10. Trapezoid
    Shape(
        name="Trapezoid",
        coordinates=[(0, 0), (LENGTH_A, 0), (LENGTH_A + LENGTH_A, LENGTH_A), (-LENGTH_A, LENGTH_A)]
    )
]

def generate_puzzle(shapes_list, showGraph):
    final_shapes_list = []

    # Debugging print statements added throughout the code

    # first, We'll move one shape into the final shapes list to start with
    first_shape = choice(shapes_list)
    print(f"First shape chosen: {first_shape.name}")
    final_shapes_list.append(first_shape)
    shapes_list.remove(first_shape)

    combined_shape = first_shape.polygon
    print(f"Initial combined shape coordinates: {list(combined_shape.exterior.coords)}")

    # now, we choose a random shape that has a side that can be shared with one of the shapes in the final shapes list
    # and try to place it there without overlapping any of the other shapes in the final shapes list
    # and we repeat this until all shapes are placed
    loop = 0
    while len(shapes_list) != 0 and loop < 50:
        loop += 1

        print(f"\n--- Loop {loop} ---")
        print(f"Remaining shapes: {[shape.name for shape in shapes_list]}")
        print(f"Final shapes: {[shape.name for shape in final_shapes_list]}")


        # Here, I want to use the combined shape to help guide where to place the next shape
        # first, I need to find a convex angle on the combined shape to work with,
        # if there are no convex angles, I'll let the algorithm run as normal without that guidance
        combined_shape_convex_points = []
        print(f"Combined shape points: {list(combined_shape.exterior.coords)[:-1]}")
        for combined_shape_point in list(combined_shape.exterior.coords)[:-1]:
            Point_A = Point(combined_shape_point)
            index = list(combined_shape.exterior.coords).index(combined_shape_point)
            Point_B = Point(list(combined_shape.exterior.coords)[(index + 1) % (len(list(combined_shape.exterior.coords)) - 1)]) # the -1 is because the last point is the same as the first point
            Point_C = Point(list(combined_shape.exterior.coords)[(index + 2) % (len(list(combined_shape.exterior.coords)) - 1)])
            print(f"Combined shape point: {Point_B}")
            if Point_A.distance(Point_B) < .01 or Point_B.distance(Point_C) < .01:
                print("convex angle caused by slight translation disparity")
                continue
            if combined_shape.covers(Point((Point_A.x + Point_C.x) / 2, (Point_A.y + Point_C.y) / 2)):
                print("Found concave angle, continuing to next point.")
                continue  # this is a concave angle, so we skip it
            angleBA = math.atan2(Point_B.y - Point_A.y, Point_B.x - Point_A.x)   # angle of the final shape side segment
            angleBC = math.atan2(Point_B.y - Point_C.y, Point_B.x - Point_C.x)   # angle of the shape to place side segment
            print(f"AngleBA: {math.degrees(angleBA)}, AngleBC: {math.degrees(angleBC)}")
            convex_angle = round(abs(math.degrees(angleBA - angleBC)))
            if convex_angle > 180:
                convex_angle = 360 - convex_angle
            print(f"angle at combined shape point: {convex_angle}")
            if (convex_angle == 45) or (convex_angle == 90) or (convex_angle == 135):
                print(f"Using convex point with angle {convex_angle} degrees: {Point_A, Point_B, Point_C}")
                combined_shape_convex_points.append((Point_A, Point_B, Point_C, Point_B.distance(Point_A), Point_B.distance(Point_C), convex_angle))

        print(f"Combined shape convex points: {combined_shape_convex_points}")

        line_segments_to_use = []
        if len(combined_shape_convex_points) == 0:
            # no convex points found, proceed as normal
            print("No convex points found on combined shape.")
            coords_to_use = list(combined_shape.exterior.coords)[:-1]
            print(f"Using combined shape coordinates: {coords_to_use}")
            for coords_to_use_index in range(len(coords_to_use)):
                x1, y1 = coords_to_use[coords_to_use_index]
                x2, y2 = coords_to_use[(coords_to_use_index + 1) % len(coords_to_use)]
                line_segments_to_use.append(((x1, y1), (x2, y2)))
        else:
            for convex_point in combined_shape_convex_points:
                line_segments_to_use.append(((convex_point[1].x, convex_point[1].y), (convex_point[0].x, convex_point[0].y), convex_point[5], convex_point[4]))  # side length from Point_B to Point_C, its twin
                line_segments_to_use.append(((convex_point[1].x, convex_point[1].y), (convex_point[2].x, convex_point[2].y), convex_point[5], convex_point[3])) # side length from Point_B to Point_A, its twin
            line_segments_to_use.extend(line_segments_to_use)
            
            coords_to_use = list(combined_shape.exterior.coords)[:-1]
            print(f"Using combined shape coordinates: {coords_to_use}")
            for coords_to_use_index in range(len(coords_to_use)):
                x1, y1 = coords_to_use[coords_to_use_index]
                x2, y2 = coords_to_use[(coords_to_use_index + 1) % len(coords_to_use)]
                line_segments_to_use.append(((x1, y1), (x2, y2)))


        # Next, we try to place the shape_to_place next to the random_final_shape
        num_of_convex_points = len(combined_shape_convex_points)
        print("highest_tier_candidate_shape_achieved reset", num_of_convex_points)
        highest_tier_candidate_shape_achieved = 0

        successfully_placed_shape = False
        for line_segments_to_use_index in range(len(line_segments_to_use)):
            num_of_convex_points -= 1
            print("num_of_convex_points now at:", num_of_convex_points)
            x1, y1 = line_segments_to_use[line_segments_to_use_index][0]
            x2, y2 = line_segments_to_use[line_segments_to_use_index][1]
            point1 = Point(x1, y1)
            point2 = Point(x2, y2)
            combined_shape_side_midpoint = Point((point1.x + point2.x) / 2, (point1.y + point2.y) / 2)
            print(f"Combined shape side midpoint: {combined_shape_side_midpoint}")
            # these two points make a line segment
            print(f"Trying line segment: ({point1.x}, {point1.y}) to ({point2.x}, {point2.y})")
            combined_shape_side_length = point1.distance(point2)
            print(f"Combined shape side length: {combined_shape_side_length}")

            candidate_shapes = []
            shuffle(shapes_list)

            if len(line_segments_to_use[line_segments_to_use_index]) > 2:
                print(f"Using combined shape side length: {combined_shape_side_length} for filtering candidate shapes.")
                print(f"Line segments being used: {line_segments_to_use[line_segments_to_use_index]}")
                convex_point_angle = line_segments_to_use[line_segments_to_use_index][2]
                print(f"Using convex point angle for matching: {convex_point_angle} degrees")
                convex_point_twin_side_length = line_segments_to_use[line_segments_to_use_index][3]
                print(f"Using convex point twin side length for matching: {convex_point_twin_side_length}")
                convex_hole_filler_list = []
                tier0_candidate_shapes = []
                tier1_candidate_shapes = []
                tier2_candidate_shapes = []
                tier3_candidate_shapes = []
                tier4_candidate_shapes = []
                for shape in shapes_list:
                    for shape_coord in shape.coordinates:
                        index = shape.coordinates.index(shape_coord)
                        shape_pointA = shape_coord
                        shape_pointB = shape.coordinates[(index + 1) % len(shape.coordinates)]
                        shape_pointC = shape.coordinates[(index + 2) % len(shape.coordinates)]
                        print(f"tier shape coords: {shape_pointA, shape_pointB, shape_pointC}")
                        shape_angleBA = math.atan2(shape_pointB[1] - shape_pointA[1], shape_pointB[0] - shape_pointA[0])   # angle of the final shape side segment
                        shape_angleBC = math.atan2(shape_pointB[1] - shape_pointC[1], shape_pointB[0] - shape_pointC[0])   # angle of the shape to place side segment
                        print(f"shape angleBA and BC: {math.degrees(shape_angleBA), math.degrees(shape_angleBC)}")
                        shape_angle = round(abs(math.degrees(shape_angleBA - shape_angleBC) % 180))
                        print(f"shape angle: {shape_angle}")
                        shape_distanceAB = ((shape_pointA[0] - shape_pointB[0]) ** 2 + (shape_pointA[1] - shape_pointB[1]) ** 2) ** 0.5
                        shape_distanceBC = ((shape_pointA[0] - shape_pointC[0]) ** 2 + (shape_pointA[1] - shape_pointC[1]) ** 2) ** 0.5
                        print(f"shape_distanceAB and shape_distanceBC: {shape_distanceAB, shape_distanceBC}")
                        if shape_angle == convex_point_angle:
                            if shape not in tier1_candidate_shapes:
                                tier1_candidate_shapes.append(shape)
                                print(f"Adding shape {shape.name} to tier 1.")
                            if (round(shape_distanceAB, 4) == round(combined_shape_side_length, 4)) or (round(shape_distanceBC, 4) == round(combined_shape_side_length, 4)):
                                if combined_shape_side_length > convex_point_twin_side_length:
                                    ratio = combined_shape_side_length / convex_point_twin_side_length
                                else:
                                    ratio = convex_point_twin_side_length / combined_shape_side_length
                                if (round(shape_distanceAB, 4) == round(convex_point_twin_side_length, 4)) or (round(shape_distanceBC, 4) == round(convex_point_twin_side_length, 4)):
                                    tier4_candidate_shapes.append(shape)
                                    print(f"Adding shape {shape.name} to tier 4.")
                                    break
                                elif (abs(ratio - round(ratio)) < 1e-3):
                                    if shape not in tier2_candidate_shapes:
                                        tier2_candidate_shapes.append(shape)
                                        print(f"Adding shape {shape.name} to tier 2.")
                            elif (round(shape_distanceAB, 4) == round(convex_point_twin_side_length, 4)) or (round(shape_distanceBC, 4) == round(convex_point_twin_side_length, 4)):
                                if combined_shape_side_length > convex_point_twin_side_length:
                                    ratio = combined_shape_side_length / convex_point_twin_side_length
                                else:
                                    ratio = convex_point_twin_side_length / combined_shape_side_length
                                if (round(shape_distanceAB, 4) == round(combined_shape_side_length, 4)) or (round(shape_distanceBC, 4) == round(combined_shape_side_length, 4)):
                                    tier4_candidate_shapes.append(shape)
                                    print(f"Adding shape {shape.name} to tier 4.")
                                    break
                                elif (abs(ratio - round(ratio)) < 1e-3):
                                    if shape not in tier3_candidate_shapes:
                                        tier3_candidate_shapes.append(shape)
                                        print(f"Adding shape {shape.name} to tier 3.")
                        else:
                            if shape not in tier1_candidate_shapes:
                                if shape not in tier0_candidate_shapes:
                                    tier0_candidate_shapes.append(shape)
                                    print(f"Adding shape {shape.name} to tier 0.")
                convex_hole_filler_list = tier4_candidate_shapes + tier2_candidate_shapes + tier3_candidate_shapes

                if len(tier4_candidate_shapes) != 0:
                    candidate_shapes.extend(tier4_candidate_shapes)
                    candidate_shapes.extend(tier3_candidate_shapes)
                    candidate_shapes.extend(tier2_candidate_shapes)
                    candidate_shapes.extend(tier1_candidate_shapes)
                    candidate_shapes.extend(tier0_candidate_shapes)
                elif len(tier2_candidate_shapes) != 0 or len(tier3_candidate_shapes) != 0:
                    candidate_shapes.extend(tier3_candidate_shapes)
                    candidate_shapes.extend(tier2_candidate_shapes)
                    candidate_shapes.extend(tier1_candidate_shapes)
                    candidate_shapes.extend(tier0_candidate_shapes)
                elif len(tier1_candidate_shapes) != 0:
                    candidate_shapes.extend(tier1_candidate_shapes)
                    candidate_shapes.extend(tier0_candidate_shapes)
                else:
                    candidate_shapes = copy.deepcopy(shapes_list)
                    print("No matching shapes found, using all shapes as candidates.")
            else:
                convex_hole_filler_list = []
                candidate_shapes = copy.deepcopy(shapes_list)
                print("No convex point angle, using all shapes as candidates.", candidate_shapes)

            # next, we try to place each remaining shape on this line segment till one works
            for original_shape in candidate_shapes:
                shape_to_place = copy.deepcopy(original_shape)
                print(shape_to_place, "23", shape_to_place.coordinates)
                for shape_to_place_coordinates_index in range(len(shape_to_place.coordinates)):
                    x3, y3 = shape_to_place.coordinates[shape_to_place_coordinates_index]
                    x4, y4 = shape_to_place.coordinates[(shape_to_place_coordinates_index + 1) % len(shape_to_place.coordinates)]
                    point3 = Point(x3, y3)
                    point4 = Point(x4, y4)
                    shape_to_place_side_midpoint = Point((point3.x + point4.x) / 2, (point3.y + point4.y) / 2)
                    print(f"Midpoint: {shape_to_place_side_midpoint}")
                    print(f"Shape_to_place line segment0: ({point3.x}, {point3.y}) to ({point4.x}, {point4.y})")
                    print(f"Shape_to_place coordinates: {shape_to_place.coordinates}")
                    
                    x5, y5 = shape_to_place.coordinates[(shape_to_place_coordinates_index + 2) % len(shape_to_place.coordinates)]
                    point5 = Point(x5, y5)

                    # this makes sure the combined_shape_side_length is divisable by the shape_to_place line segment or vice versa
                    if combined_shape_side_length > point3.distance(point4):
                        ratio = combined_shape_side_length / point3.distance(point4)
                    else:
                        ratio = point3.distance(point4) / combined_shape_side_length
                    if not abs(ratio - round(ratio)) < 1e-3:
                        print("shape side length does not divide into combined shape side length or vice versa. Skipping.")
                        continue
                    # this translates the shape_to_place so that its line segment shares one point with the random_final_shape line segment
                    print("Line segment ok. Aligning shapes.")
                    print(f"Translating shape_to_place by ({point1.x - point4.x}, {point1.y - point4.y})")
                    xtranslate = point1.x - point4.x
                    ytranslate = point1.y - point4.y
                    shape_to_place.translate(xtranslate, ytranslate)
                    point3 = translate(point3, xoff=xtranslate, yoff=ytranslate)
                    point4 = translate(point4, xoff=xtranslate, yoff=ytranslate)
                    point5 = translate(point5, xoff=xtranslate, yoff=ytranslate)
                    shape_to_place_side_midpoint = translate(shape_to_place_side_midpoint, xoff=xtranslate, yoff=ytranslate)
                    print(f"Shape_to_place line segment1: ({point3.x}, {point3.y}) to ({point4.x}, {point4.y})")
                    print(f"Translated shape_to_place to: {shape_to_place.coordinates}")

                    # this rotates the shape_to_place so that its line segment is now aligned with the random_final_shape line segment
                    angle1 = math.atan2(point2.y - point1.y, point2.x - point1.x)   # angle of the final shape side segment
                    angle2 = math.atan2(point3.y - point4.y, point3.x - point4.x)   # angle of the shape to place side segment
                    print(f"Angle1: {math.degrees(angle1)}, Angle2: {math.degrees(angle2)}")
                    rotation_angle = math.degrees(angle1 - angle2)
                    print(f"Rotation angle: {rotation_angle}")
                    xRotateOrigin = point1.x
                    yRotateOrigin = point1.y
                    shape_to_place.rotate(rotation_angle, origin=(xRotateOrigin, yRotateOrigin))
                    point3 = rotate(point3, rotation_angle, origin=(xRotateOrigin, yRotateOrigin))
                    point4 = rotate(point4, rotation_angle, origin=(xRotateOrigin, yRotateOrigin))
                    point5 = rotate(point5, rotation_angle, origin=(xRotateOrigin, yRotateOrigin))
                    shape_to_place_side_midpoint = rotate(shape_to_place_side_midpoint, rotation_angle, origin=(xRotateOrigin, yRotateOrigin))
                    print(f"Shape_to_place line segment2: ({point3.x}, {point3.y}) to ({point4.x}, {point4.y})")
                    print(f"Rotated shape_to_place_side_midpoint to: ({shape_to_place_side_midpoint.x}, {shape_to_place_side_midpoint.y})")
                    print(f"Rotated shape_to_place to: {shape_to_place.coordinates}")

                    # Here, we check eight different orientations/positions of the shape_to_place and check every time if it overlaps with the combined_shape
                    # check if the the shape_to_place is facing the wrong way (aka towards the random_final_shape)
                    for rotation in range(2):  # tries both sides of the shape
                        if not (combined_shape.covers(shape_to_place.polygon) or shape_to_place.polygon.covers(combined_shape) or combined_shape.buffer(-1e-4).intersects(shape_to_place.polygon)):
                            if shape_to_place in convex_hole_filler_list:
                                print(f"Placing convex hole filler shape: {shape_to_place.name}")
                                if (shape_to_place in tier4_candidate_shapes or shape_to_place in tier2_candidate_shapes) and round(combined_shape_side_length, 2) == round(point3.distance(point4), 2):
                                    print("Shape fits perfectly on combined shape side. Proceeding to place shape.")
                                    if shape_to_place in tier2_candidate_shapes:
                                        break
                                    elif shape_to_place in tier4_candidate_shapes and round(convex_point_twin_side_length, 2) == round(point4.distance(point5), 2):
                                        print("Shape also fits perfectly on convex point twin side. Proceeding to place shape.")
                                        break
                                    else:
                                        pass
                                elif (shape_to_place in tier3_candidate_shapes) and round(convex_point_twin_side_length, 2) == round(point4.distance(point5), 2):
                                    print("Shape fits perfectly on convex point twin side. Proceeding to place shape.")
                                    break
                                else:
                                    pass
                            else:
                                break
                        shape_to_place.rotate(180, origin=(shape_to_place_side_midpoint.x, shape_to_place_side_midpoint.y))
                        point3 = rotate(point3, 180, origin=(shape_to_place_side_midpoint.x, shape_to_place_side_midpoint.y))
                        point4 = rotate(point4, 180, origin=(shape_to_place_side_midpoint.x, shape_to_place_side_midpoint.y))
                        point5 = rotate(point5, 180, origin=(shape_to_place_side_midpoint.x, shape_to_place_side_midpoint.y))
                        if not (combined_shape.covers(shape_to_place.polygon) or shape_to_place.polygon.covers(combined_shape) or combined_shape.buffer(-1e-4).intersects(shape_to_place.polygon)):
                            if shape_to_place in convex_hole_filler_list:
                                print(f"Placing convex hole filler shape: {shape_to_place.name}")
                                if (shape_to_place in tier4_candidate_shapes or shape_to_place in tier2_candidate_shapes) and round(combined_shape_side_length, 2) == round(point3.distance(point4), 2):
                                    print("Shape fits perfectly on combined shape side. Proceeding to place shape.")
                                    if shape_to_place in tier2_candidate_shapes:
                                        break
                                    elif shape_to_place in tier4_candidate_shapes and round(convex_point_twin_side_length, 2) == round(point4.distance(point5), 2):
                                        print("Shape also fits perfectly on convex point twin side. Proceeding to place shape.")
                                        break
                                    else:
                                        pass
                                elif (shape_to_place in tier3_candidate_shapes) and round(convex_point_twin_side_length, 2) == round(point4.distance(point5), 2):
                                    print("Shape fits perfectly on convex point twin side. Proceeding to place shape.")
                                    break
                                else:
                                    pass
                            else:
                                break
                        shape_to_place.rotate(180, origin=(combined_shape_side_midpoint.x, combined_shape_side_midpoint.y))
                        point3 = rotate(point3, 180, origin=(combined_shape_side_midpoint.x, combined_shape_side_midpoint.y))
                        point4 = rotate(point4, 180, origin=(combined_shape_side_midpoint.x, combined_shape_side_midpoint.y))
                        point5 = rotate(point5, 180, origin=(combined_shape_side_midpoint.x, combined_shape_side_midpoint.y))
                        shape_to_place_side_midpoint = rotate(shape_to_place_side_midpoint, 180, origin=(combined_shape_side_midpoint.x, combined_shape_side_midpoint.y))
                        if not (combined_shape.covers(shape_to_place.polygon) or shape_to_place.polygon.covers(combined_shape) or combined_shape.buffer(-1e-2).intersects(shape_to_place.polygon)):
                            if shape_to_place in convex_hole_filler_list:
                                print(f"Placing convex hole filler shape: {shape_to_place.name}")
                                if (shape_to_place in tier4_candidate_shapes or shape_to_place in tier2_candidate_shapes) and round(combined_shape_side_length, 2) == round(point3.distance(point4), 2):
                                    print("Shape fits perfectly on combined shape side. Proceeding to place shape.")
                                    if shape_to_place in tier2_candidate_shapes:
                                        break
                                    elif shape_to_place in tier4_candidate_shapes and round(convex_point_twin_side_length, 2) == round(point4.distance(point5), 2):
                                        print("Shape also fits perfectly on convex point twin side. Proceeding to place shape.")
                                        break
                                    else:
                                        pass
                                elif (shape_to_place in tier3_candidate_shapes) and round(convex_point_twin_side_length, 2) == round(point4.distance(point5), 2):
                                    print("Shape fits perfectly on convex point twin side. Proceeding to place shape.")
                                    break
                                else:
                                    pass
                            else:
                                break
                        shape_to_place.rotate(180, origin=(shape_to_place_side_midpoint.x, shape_to_place_side_midpoint.y))
                        point3 = rotate(point3, 180, origin=(shape_to_place_side_midpoint.x, shape_to_place_side_midpoint.y))
                        point4 = rotate(point4, 180, origin=(shape_to_place_side_midpoint.x, shape_to_place_side_midpoint.y))
                        point5 = rotate(point5, 180, origin=(shape_to_place_side_midpoint.x, shape_to_place_side_midpoint.y))
                        if not (combined_shape.covers(shape_to_place.polygon) or shape_to_place.polygon.covers(combined_shape) or combined_shape.buffer(-1e-4).intersects(shape_to_place.polygon)):
                            if shape_to_place in convex_hole_filler_list:
                                print(f"Placing convex hole filler shape: {shape_to_place.name}")
                                if (shape_to_place in tier4_candidate_shapes or shape_to_place in tier2_candidate_shapes) and round(combined_shape_side_length, 2) == round(point3.distance(point4), 2):
                                    print("Shape fits perfectly on combined shape side. Proceeding to place shape.")
                                    if shape_to_place in tier2_candidate_shapes:
                                        break
                                    elif shape_to_place in tier4_candidate_shapes and round(convex_point_twin_side_length, 2) == round(point4.distance(point5), 2):
                                        print("Shape also fits perfectly on convex point twin side. Proceeding to place shape.")
                                        break
                                    else:
                                        pass
                                elif (shape_to_place in tier3_candidate_shapes) and round(convex_point_twin_side_length, 2) == round(point4.distance(point5), 2):
                                    print("Shape fits perfectly on convex point twin side. Proceeding to place shape.")
                                    break
                                else:
                                    pass
                            else:
                                break
                        # if it overlaps, we try flipping the shape_to_place along the aligned line segment
                        if rotation == 0:
                            print("Flipping shape.")
                            print(f"Coordinates before flipping: {shape_to_place.coordinates}")
                            print(f"Midpoint before flipping: {shape_to_place_side_midpoint}")
                            print(f"Line segment to flip around: ({point3.x}, {point3.y}) to ({point4.x}, {point4.y})")
                            shape_to_place_side_angle = math.atan2(point4.y - point3.y, point4.x - point3.x)
                            print(f"Shape to place side angle: {math.degrees(shape_to_place_side_angle)}")
                            shape_to_place.rotate(math.degrees(-shape_to_place_side_angle), origin=(shape_to_place_side_midpoint.x, shape_to_place_side_midpoint.y))
                            point5 = rotate(point5, math.degrees(-shape_to_place_side_angle), origin=(shape_to_place_side_midpoint.x, shape_to_place_side_midpoint.y))
                            print(f"Coordinates after rotating to 0 degrees: {shape_to_place.coordinates}")
                            shape_to_place.reflect(axis='x', origin=(shape_to_place_side_midpoint.x, shape_to_place_side_midpoint.y))
                            point5 = rotate(point5, 180, origin=(point5.x, shape_to_place_side_midpoint.y))
                            print(f"Coordinates after reflection: {shape_to_place.coordinates}")
                            shape_to_place.rotate(math.degrees(shape_to_place_side_angle), origin=(shape_to_place_side_midpoint.x, shape_to_place_side_midpoint.y))
                            point5 = rotate(point5, math.degrees(shape_to_place_side_angle), origin=(shape_to_place_side_midpoint.x, shape_to_place_side_midpoint.y))
                            print(f"Coordinates after rotating back: {shape_to_place.coordinates}")
                            print(f"Line segment points to: ({point3.x}, {point3.y}) to ({point4.x}, {point4.y})")
                            print(f"Coordinates after flipping: {shape_to_place.coordinates}")

                        # if all conditions are satisfied, we place the shape_to_place
                    if not (combined_shape.covers(shape_to_place.polygon) or shape_to_place.polygon.covers(combined_shape) or combined_shape.buffer(-1e-4).intersects(shape_to_place.polygon)):

                        if num_of_convex_points >= 0:
                            if shape_to_place in tier4_candidate_shapes:
                                highest_tier_candidate_shape_achieved = 4
                            elif (shape_to_place in tier3_candidate_shapes or shape_to_place in tier2_candidate_shapes) and highest_tier_candidate_shape_achieved < 4:
                                highest_tier_candidate_shape_achieved = 2.5
                            elif shape_to_place in tier1_candidate_shapes and highest_tier_candidate_shape_achieved < 2.5:
                                highest_tier_candidate_shape_achieved = 1
                            print(f"shape_to_place: {shape_to_place}")
                            print(tier4_candidate_shapes)
                            print(tier3_candidate_shapes)
                            print(tier2_candidate_shapes)
                            print(tier1_candidate_shapes)
                            print(f"highest_tier_candidate_shape_achieved: {highest_tier_candidate_shape_achieved}")
                        else:
                            if (highest_tier_candidate_shape_achieved == 4 and shape_to_place in tier4_candidate_shapes) or (highest_tier_candidate_shape_achieved == 2.5 and (shape_to_place in tier3_candidate_shapes or shape_to_place in tier2_candidate_shapes)) or (highest_tier_candidate_shape_achieved == 1 and shape_to_place in tier1_candidate_shapes) or (highest_tier_candidate_shape_achieved == 0):
                                # updating the combined shape
                                print(f"Combined shape before union: {combined_shape}")
                                print(f"Shape to place (not scaled): {shape_to_place.scaled(1.0, 1.0).polygon}")
                                print(f"Shape to place (scaled): {shape_to_place.scaled(1.01, 1.01).polygon}")
                                combined_shape = (combined_shape.buffer(1e-8).union(shape_to_place.polygon.buffer(1e-8)).buffer(-1e-8))
                                combined_shape = combined_shape.buffer(0)
                                combined_shape = snap(combined_shape, combined_shape, 1e-3)
                                combined_shape = combined_shape.simplify(1e-3, preserve_topology=True)

                                print(f"Combined shape after union: {combined_shape}")
                                successfully_placed_shape = True
                                if isinstance(combined_shape, MultiPolygon):
                                    graph_everything(final_shapes_list, .4, 'black', 'Could not place all shapes, something went wrong', loop)
                                # this moves the shape_to_place from the shapes_list to the final_shapes_list where it won't be altered anymore
                                print(f"Placing shape: {shape_to_place.name}")
                                print(f"final shapes list: {final_shapes_list}")
                                print(f"shapes list: {shapes_list}")
                                for shape in shapes_list:
                                    if shape_to_place.name == shape.name:
                                        shapes_list.remove(shape)
                                        break
                                final_shapes_list.append(shape_to_place)
                                break

                if successfully_placed_shape:
                    print("hit 1")
                    break
            if successfully_placed_shape:
                print("hit 2")
                break
        if not successfully_placed_shape:
            print("Could not place shape. Trying again with a new random_final_shape.\n\n\n")
        else:
            print(f"Successfully placed shape: {shape_to_place.name}\n\n")
            shape_to_place = None
    if len(shapes_list) == 0:
        print("All shapes placed successfully!")
        combined_shape_obj = Shape("Combined Shape", list(combined_shape.exterior.coords)[:-1])
        if (showGraph):
            final_combined_shape_list = [combined_shape_obj]
            graph_everything(final_combined_shape_list, 1.0, 'black', 'Custom Tangram Puzzle Maker', loop)
            graph_everything(final_shapes_list, 0.9, 'red', 'Custom Tangram Puzzle Maker - Solved', loop)
        return [combined_shape_obj, final_shapes_list]
    else:
        print("Could not place all shapes, something went wrong. Try again")
        print(f"Shapes remaining: {[shape.name for shape in shapes_list]}")
        combined_shape_obj = Shape("Combined Shape", list(combined_shape.exterior.coords)[:-1])
        if (showGraph):
            final_combined_shape_list = [combined_shape_obj]
            graph_everything([combined_shape_obj], 1.0, 'black', 'Could not place all shapes, something went wrong', loop)
            graph_everything(final_shapes_list, 0.9, 'red', f"Shapes remaining: {[shape.name for shape in shapes_list]}", loop)
        return [combined_shape_obj, final_shapes_list]