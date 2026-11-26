"""Измерения для проверок: расстояние от точек до ближайшей линии, точки вдоль линий.

Линии — массивы вершин в метрах (n, 2). Расстояния считаются до отрезков через пространственный
индекс shapely (STRtree), поэтому сотни тысяч точек проверяются за секунды.
"""

import numpy as np
import shapely
from shapely import LinearRing, LineString, STRtree
from shapely.geometry.base import BaseGeometry

from geodata.geometry import parts

# Случайные выборки точек повторяемы: один и тот же прогон даёт один и тот же итог.
SEED = 20261110


def rings_of(geometry: BaseGeometry) -> list[LinearRing]:
    """Все кольца полигонов геометрии: внешние и дыры."""
    return [ring for part in parts(geometry) for ring in (part.exterior, *part.interiors)]


def segments(lines: list[np.ndarray]) -> np.ndarray:
    """Отрезки полилиний: массив (n, 2, 2)."""
    chunks = [np.stack([line[:-1], line[1:]], axis=1) for line in lines if len(line) > 1]
    return np.concatenate(chunks) if chunks else np.empty((0, 2, 2))


def tree_of(lines: list[np.ndarray]) -> STRtree:
    return STRtree(shapely.linestrings(segments(lines)))


def distances(tree: STRtree, points: np.ndarray) -> np.ndarray:
    """Расстояние от каждой точки до ближайшего отрезка дерева (inf, если дерево пустое)."""
    if not len(points):
        return np.empty(0)
    if not len(tree.geometries):
        return np.full(len(points), np.inf)
    pairs, found = tree.query_nearest(
        shapely.points(points), all_matches=False, return_distance=True
    )
    result = np.full(len(points), np.inf)
    result[pairs[0]] = found
    return result


def polylines(lines: list[np.ndarray]) -> list[LineString]:
    return [shapely.LineString(line) for line in lines if len(line) > 1]


def sample_along(lines: list[np.ndarray], step: float) -> np.ndarray:
    """Вершины полилиний и точки между ними не реже шага."""
    return shapely.get_coordinates(shapely.segmentize(polylines(lines), step))
