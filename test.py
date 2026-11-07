import math


def  calculate_circle_area(radius):
    if radius < 0:
        raise ValueError("Radius cannot be negative")
    return math.pi * radius ** 2

calculated_area = calculate_circle_area(5)

print(f"Площадь круга: {calculated_area:.2f}")