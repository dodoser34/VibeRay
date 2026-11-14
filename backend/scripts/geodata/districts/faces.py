"""Грани: куски, на которые линии (границы, улицы, берега) режут город.

Все линии узлуются на сетке координат OSM (GRID): две линии, проходящие через один узел OSM,
получают в нём общую вершину. Поэтому соседние районы, собранные из граней, имеют общую границу
из одних и тех же вершин.
"""

from pathlib import Path

import shapely
from shapely.geometry import Polygon, box, shape
from shapely.ops import polygonize, unary_union

from geodata.geometry import parts
from geodata.output import read_json

GRID = 1e-7  # сетка координат OSM (7 знаков после запятой)
WATER_MARGIN_DEG = 0.01


def load_water(folder: Path, bounds: tuple[float, float, float, float]):
    """Вода города одной геометрией в рамке районов (в файле крупные водоёмы разрезаны сеткой)."""
    frame = box(*bounds).buffer(WATER_MARGIN_DEG)
    collection = read_json(folder / 'water.geojson')
    polygons = [shapely.make_valid(shape(f['geometry'])) for f in collection['features']]
    merged = unary_union([p for p in polygons if p.intersects(frame)]).intersection(frame)
    return unary_union(parts(merged))


def faces_of(lines: list) -> list[Polygon]:
    """Грани сети линий, узлованной на сетке координат OSM."""
    return list(polygonize(shapely.union_all(lines, grid_size=GRID)))


def land_mask(faces: list[Polygon], water) -> list[bool]:
    """Какие грани — суша. Контур воды входит в сеть, поэтому грань целиком либо суша, либо вода."""
    shapely.prepare(water)
    points = shapely.point_on_surface(faces)
    return [not wet for wet in shapely.contains(water, points)]
