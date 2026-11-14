"""Последние шаги сборки районов: общая сеть вершин, отброс щепок, раскраска."""

from collections import defaultdict

import shapely
from shapely import STRtree
from shapely.geometry import MultiPolygon
from shapely.geometry.polygon import orient

from geodata.districts.faces import faces_of
from geodata.geometry import METERS_PER_DEGREE, area_m2, parts

MIN_PART_M2 = 20_000  # клочок суши меньше этого (щепка у берега, островок) в районы не входит
HAIR_DEG = 6e-7  # ~5 см: щель уже этого между районами — след округления, а не земля
PALETTE_SIZE = 12  # цвета районов --district-1 … --district-12 в темах фронтенда
NEAR_M = 150  # районы ближе этого (через реку, протоку) — тоже соседи для раскраски


def renode(districts: dict, water) -> dict:
    """Общая граница соседей — из одних вершин: после правок чистки сеть границ узлуется заново
    и каждая грань отходит району, внутри которого лежит."""
    slugs = list(districts)
    faces = faces_of([districts[slug].boundary for slug in slugs])
    points = shapely.point_on_surface(faces)
    tree = STRtree([districts[slug] for slug in slugs])
    owners: dict[int, int] = {}
    for face, owner in zip(*tree.query(points, predicate='within'), strict=True):
        owners.setdefault(int(face), int(owner))  # грань, которую делят двое, — первому
    # Волосяная щель между соседями (сантиметры после правок) — ближайшему району. Дыра района
    # тоже касается его, но если это вода (крошечный водоём у берега), она остаётся дырой.
    shapely.prepare(water)
    wet = shapely.contains(water, points)
    near = tree.query(points, predicate='dwithin', distance=HAIR_DEG)
    for face, owner in zip(*near, strict=True):
        if not wet[face]:
            owners.setdefault(int(face), int(owner))
    groups = defaultdict(list)
    for face, owner in owners.items():
        groups[slugs[owner]].append(faces[face])
    return {slug: shapely.coverage_union_all(groups[slug]) for slug in slugs}


def clean(raw: dict, lat0: float) -> dict[str, MultiPolygon]:
    """Районы без щепок; кольца — в порядке GeoJSON (внешнее против часовой стрелки), куски района —
    от большего к меньшему.

    Щепка — отдельный клочок суши (все районы вместе) меньше MIN_PART_M2: остров или полоса берега,
    которую делят два района, меряется целиком, а не по кускам каждого района."""
    masses = parts(shapely.coverage_union_all([p for g in raw.values() for p in parts(g)]))
    tree = STRtree(masses)
    result = {}
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
    """Номер цвета (palette) каждого района: у соседей разные. Прежний цвет района остаётся, если
    не спорит с соседом, — пересборка не перекрашивает всю карту."""
    slugs = list(districts)
    reach = NEAR_M / METERS_PER_DEGREE
    tree = STRtree([districts[s] for s in slugs])
    adjacent: dict[str, set[str]] = {s: set() for s in slugs}
    near = tree.query([districts[s] for s in slugs], distance=reach, predicate='dwithin')
    for a, b in zip(*near, strict=True):
        if a != b:
            adjacent[slugs[a]].add(slugs[b])
    palette: dict[str, int] = {}
    for slug in sorted(slugs, key=lambda item: -len(adjacent[item])):
        taken = {palette[n] for n in adjacent[slug] if n in palette}
        if previous.get(slug) and previous[slug] not in taken:
            palette[slug] = previous[slug]
            continue
        used = list(palette.values())
        free = [c for c in range(1, PALETTE_SIZE + 1) if c not in taken]
        palette[slug] = min(free, key=used.count)
    return palette
