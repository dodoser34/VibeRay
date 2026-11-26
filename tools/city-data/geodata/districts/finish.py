"""Последние шаги сборки районов: общая сеть вершин, отброс щепок, раскраска."""

from collections import defaultdict

import shapely
from shapely import STRtree
from shapely.geometry import MultiPolygon, Polygon
from shapely.geometry.base import BaseGeometry
from shapely.geometry.polygon import orient

from geodata.districts.faces import Districts, faces_of
from geodata.geometry import METERS_PER_DEGREE, area_m2, parts

# Клочок суши меньше этого (м²) — щепка у берега, островок — в районы не входит.
MIN_PART_M2 = 20_000
# Щель между районами уже этого (~5 см) — след округления, а не земля.
HAIR_DEG = 6e-7
# Цвета районов --district-1 … --district-12 в темах фронтенда.
PALETTE_SIZE = 12
# Районы ближе этого (м), например через реку или протоку, — тоже соседи для раскраски.
NEAR_M = 150


def renode(districts: Districts, water: BaseGeometry) -> Districts:
    """Районы, у которых общая граница соседей состоит из одних вершин.

    После правок чистки сеть границ узлуется заново, и каждая грань отходит району, внутри
    которого лежит.
    """
    slugs = list(districts)
    faces = faces_of([districts[slug].boundary for slug in slugs])
    points = shapely.point_on_surface(faces)
    tree = STRtree([districts[slug] for slug in slugs])
    owners: dict[int, int] = {}
    for face, owner in zip(*tree.query(points, predicate='within'), strict=True):
        # Грань, которую делят двое, отходит первому.
        owners.setdefault(int(face), int(owner))
    shapely.prepare(water)
    wet = shapely.contains(water, points)
    # Волосяная щель между соседями (сантиметры после правок) отходит ближайшему району. Дыра
    # района тоже касается его, но если это вода (крошечный водоём у берега), она остаётся дырой.
    near = tree.query(points, predicate='dwithin', distance=HAIR_DEG)
    for face, owner in zip(*near, strict=True):
        if not wet[face]:
            owners.setdefault(int(face), int(owner))
    groups: dict[str, list[Polygon]] = defaultdict(list)
    for face, owner in owners.items():
        groups[slugs[owner]].append(faces[face])
    return {slug: shapely.coverage_union_all(groups[slug]) for slug in slugs}


def clean(raw: Districts, lat0: float) -> dict[str, MultiPolygon]:
    """Районы без щепок, готовые к записи в GeoJSON.

    Кольца идут в порядке GeoJSON (внешнее против часовой стрелки), куски района — от большего
    к меньшему. Щепка — отдельный клочок суши (все районы вместе) меньше MIN_PART_M2: остров или
    полоса берега, которую делят два района, меряется целиком, а не по кускам каждого района.
    """
    pieces = [part for geometry in raw.values() for part in parts(geometry)]
    masses = parts(shapely.coverage_union_all(pieces))
    tree = STRtree(masses)
    result: dict[str, MultiPolygon] = {}
    for slug, geometry in raw.items():
        pieces = parts(geometry)
        points = shapely.point_on_surface(pieces)
        mass_of = dict(zip(*tree.query(points, predicate='within'), strict=True))
        kept = [
            orient(piece)
            for index, piece in enumerate(pieces)
            if area_m2(masses[mass_of[index]], lat0) >= MIN_PART_M2
        ]
        kept.sort(key=lambda part: -part.area)
        result[slug] = MultiPolygon(kept)
    return result


def colorize(districts: dict[str, MultiPolygon], previous: dict[str, int]) -> dict[str, int]:
    """Номер цвета (palette) каждого района; у соседей цвета разные.

    Прежний цвет района остаётся, если не спорит с соседом: пересборка не перекрашивает всю карту.
    """
    slugs = list(districts)
    reach = NEAR_M / METERS_PER_DEGREE
    shapes = [districts[slug] for slug in slugs]
    tree = STRtree(shapes)
    adjacent: dict[str, set[str]] = {slug: set() for slug in slugs}
    near = tree.query(shapes, distance=reach, predicate='dwithin')
    for a, b in zip(*near, strict=True):
        if a != b:
            adjacent[slugs[a]].add(slugs[b])
    palette: dict[str, int] = {}
    for slug in sorted(slugs, key=lambda item: -len(adjacent[item])):
        taken = {palette[other] for other in adjacent[slug] if other in palette}
        if previous.get(slug) and previous[slug] not in taken:
            palette[slug] = previous[slug]
            continue
        used = list(palette.values())
        free = [color for color in range(1, PALETTE_SIZE + 1) if color not in taken]
        palette[slug] = min(free, key=used.count)
    return palette
