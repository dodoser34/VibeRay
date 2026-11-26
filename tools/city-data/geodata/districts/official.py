"""Районы официального деления: территория отношения OSM целиком, вершины OSM без упрощения.

Границы районов и контур воды узлуются в одну сеть; каждая грань-суша отходит району, внутри
которого лежит. Так общая граница соседей — из одних вершин, а берег района совпадает с берегом
воды.
"""

from collections import defaultdict
from pathlib import Path
from typing import Any

import shapely
from shapely import STRtree
from shapely.geometry import LineString, Point, Polygon
from shapely.geometry.base import BaseGeometry
from shapely.ops import polygonize, unary_union

from cities import CityConfig
from geodata.districts.faces import GRID, Districts, faces_of, land_mask, load_water
from geodata.geometry import parts
from geodata.osm import find_relations, official_boundaries, relation_area


def official_areas(slug: str, config: CityConfig, lat0: float) -> Districts:
    """Территории районов: отношения OSM с ручными правками из cities.py."""
    return apply_manual_edits(relation_areas(slug, config, lat0), config)


def relation_areas(slug: str, config: CityConfig, lat0: float) -> Districts:
    """Территории районов ровно как отношения OSM."""
    relations = find_relations(official_boundaries(slug, config['query']), config['districts'])
    return {district: relation_area(relations[district], lat0) for district in relations}


def apply_manual_edits(areas: Districts, config: CityConfig) -> Districts:
    """Территории с правками по разметке пользователя.

    Правки — заливы (bays), заливки за городом (fills) и выброшенные куски (drops). Каждая
    правка задана прямой между узлами OSM или точкой внутри куска.
    """
    for bay in config.get('bays', []):
        close_bay(areas, bay)
    for fill in config.get('fills', []):
        fill_gap(areas, fill)
    for drop in config.get('drops', []):
        drop_piece(areas, drop)
    return areas


def pockets(line: LineString, boundary: BaseGeometry) -> list[Polygon]:
    """Куски, которые прямая (концы — вершины границы) отрезает вместе с границей района."""
    pieces = polygonize(shapely.union_all([line, boundary], grid_size=GRID))
    return [piece for piece in pieces if piece.boundary.intersection(line).length > 0]


def close_bay(areas: Districts, bay: dict[str, Any]) -> None:
    """Отдать району to кусок района from между хордой и границей района to.

    Концы хорды — вершины границы района to.
    """
    chord = LineString(bay['chord'])
    giver, taker = bay['from'], bay['to']
    shapely.prepare(areas[giver])
    moved = [
        piece
        for piece in pockets(chord, areas[taker].boundary)
        if areas[giver].contains(piece.representative_point())
    ]
    if not moved:
        raise SystemExit(f'залив {giver} → {taker}: хорда не замыкает залив')
    gulf = unary_union(moved)
    areas[taker] = unary_union([areas[taker], gulf])
    areas[giver] = areas[giver].difference(gulf)


def fill_gap(areas: Districts, fill: dict[str, Any]) -> None:
    """Отдать району землю за границей города между линией и районом.

    Концы и изломы линии — вершины района (у отдельного куска района — тоже): так провал между
    зубцами границы закрывается прямыми, а отдельный кусок присоединяется к району.
    """
    line = LineString(fill['line'])
    district = fill['district']
    city = unary_union(list(areas.values()))
    shapely.prepare(city)
    outside = [
        piece
        for piece in pockets(line, areas[district].boundary)
        if not city.contains(piece.representative_point())
    ]
    if not outside:
        raise SystemExit(f'заливка {district}: линия не замыкает землю за городом')
    gap = unary_union(outside).difference(city)
    areas[district] = unary_union([areas[district], gap])


def drop_piece(areas: Districts, drop: dict[str, Any]) -> None:
    """Убрать отдельный кусок района, в котором лежит точка (эксклав далеко за городом)."""
    district = drop['district']
    point = Point(drop['point'])
    pieces = parts(areas[district])
    kept = [piece for piece in pieces if not piece.contains(point)]
    if len(kept) == len(pieces) or not kept:
        raise SystemExit(f'выброс куска {district}: точка не внутри отдельного куска района')
    areas[district] = unary_union(kept)


def official_districts(
    slug: str, config: CityConfig, folder: Path, lat0: float
) -> tuple[Districts, Districts, BaseGeometry]:
    """Районы города: (районы без воды, территории OSM с ручными правками, вода)."""
    areas = official_areas(slug, config, lat0)
    water = load_water(folder, unary_union(list(areas.values())).bounds)

    faces = faces_of([*(area.boundary for area in areas.values()), water.boundary])
    land = land_mask(faces, water)
    slugs = list(areas)
    tree = STRtree([areas[district] for district in slugs])
    inside = tree.query(shapely.point_on_surface(faces), predicate='within')
    groups: dict[str, list[Polygon]] = defaultdict(list)
    for face, district in dict(zip(*inside, strict=True)).items():
        if land[face]:
            groups[slugs[district]].append(faces[face])
    districts = {district: shapely.coverage_union_all(groups[district]) for district in slugs}
    return districts, areas, water
