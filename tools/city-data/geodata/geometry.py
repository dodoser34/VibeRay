"""Градусы и метры.

Координаты в файлах — градусы (долгота, широта). Площади и расстояния считаются в метрах: вокруг
города градус долготы и градус широты заменяются постоянными длинами (локальная проекция). Для
города размером в десятки километров ошибка такой замены — доли процента.
"""

import math

import shapely
from shapely.geometry import Polygon
from shapely.geometry.base import BaseGeometry

METERS_PER_DEGREE = 111_320


def scale(lat0: float) -> tuple[float, float]:
    """Метров в градусе долготы и в градусе широты на широте города."""
    return math.cos(math.radians(lat0)) * METERS_PER_DEGREE, METERS_PER_DEGREE


def area_m2(geometry: BaseGeometry, lat0: float) -> float:
    """Площадь геометрии в квадратных метрах."""
    kx, ky = scale(lat0)
    return geometry.area * kx * ky


def parts(geometry: BaseGeometry) -> list[Polygon]:
    """Все полигоны геометрии.

    Линии и точки, которые оставляют вычитания и пересечения, отбрасываются.
    """
    if geometry.is_empty:
        return []
    if isinstance(geometry, Polygon):
        return [geometry]
    return [polygon for part in getattr(geometry, 'geoms', []) for polygon in parts(part)]


class Projection:
    """Перевод геометрии из градусов в метры вокруг города и обратно."""

    def __init__(self, lat0: float) -> None:
        self.kx, self.ky = scale(lat0)

    def to_meters(self, geometry: BaseGeometry) -> BaseGeometry:
        return shapely.transform(geometry, lambda coords: coords * [self.kx, self.ky])

    def to_degrees(self, geometry: BaseGeometry) -> BaseGeometry:
        return shapely.transform(geometry, lambda coords: coords / [self.kx, self.ky])
