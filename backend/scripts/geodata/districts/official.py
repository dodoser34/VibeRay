"""Районы официального деления: территория отношения OSM целиком, вершины OSM без упрощения.

Границы районов и контур воды узлуются в одну сеть; каждая грань-суша отходит району, внутри
которого лежит. Так общая граница соседей — из одних вершин, а берег района совпадает с берегом
воды.
"""

from collections import defaultdict
from pathlib import Path

import shapely
from shapely import STRtree
from shapely.geometry import LineString, Point
from shapely.ops import polygonize, unary_union

from geodata.districts.faces import GRID, faces_of, land_mask, load_water
from geodata.geometry import parts
from geodata.osm import find_relations, official_boundaries, relation_area


def official_areas(slug: str, config: dict, lat0: float) -> dict:
    """Территории районов (slug → полигон в градусах): отношения OSM с ручными правками из
    cities.py."""
    return apply_manual_edits(relation_areas(slug, config, lat0), config)


def relation_areas(slug: str, config: dict, lat0: float) -> dict:
    """Территории районов ровно как отношения OSM."""
    relations = find_relations(official_boundaries(slug, config['query']), config['districts'])
    return {district: relation_area(relations[district], lat0) for district in relations}


def apply_manual_edits(areas: dict, config: dict) -> dict:
    """Правки по разметке пользователя: заливы (bays), заливки за городом (fills), выброшенные
    куски (drops). Каждая правка — прямая между узлами OSM или точка внутри куска."""
    for bay in config.get('bays', []):
        close_bay(areas, bay)
    for fill in config.get('fills', []):
        fill_gap(areas, fill)
    for drop in config.get('drops', []):
        drop_piece(areas, drop)
    return areas


def pockets(line: LineString, boundary) -> list:
    """Куски, которые прямая (концы — вершины границы) отрезает вместе с границей района."""
    pieces = polygonize(shapely.union_all([line, boundary], grid_size=GRID))
    return [piece for piece in pieces if piece.boundary.intersection(line).length > 0]


def close_bay(areas: dict, bay: dict) -> None:
    """Кусок района from между хордой и границей района to (концы хорды — вершины его границы)
    отходит району to."""
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


def fill_gap(areas: dict, fill: dict) -> None:
    """Земля за границей города между линией и районом отходит району. Концы и изломы линии —
    вершины района (у отдельного куска района — тоже): так провал между зубцами границы закрывается
    прямыми, а отдельный кусок присоединяется к району."""
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


def drop_piece(areas: dict, drop: dict) -> None:
    """Отдельный кусок района, в котором лежит точка (эксклав далеко за городом), на карту
    не идёт."""
    district = drop['district']
    point = Point(drop['point'])
    pieces = parts(areas[district])
    kept = [piece for piece in pieces if not piece.contains(point)]
    if len(kept) == len(pieces) or not kept:
        raise SystemExit(f'выброс куска {district}: точка не внутри отдельного куска района')
    areas[district] = unary_union(kept)


def official_districts(slug: str, config: dict, folder: Path, lat0: float):
    """Районы города: (районы без воды, территории OSM с ручными правками, вода)."""
    areas = official_areas(slug, config, lat0)
    water = load_water(folder, unary_union(list(areas.values())).bounds)

    faces = faces_of([*(area.boundary for area in areas.values()), water.boundary])
    land = land_mask(faces, water)
    slugs = list(areas)
    tree = STRtree([areas[district] for district in slugs])
    inside = tree.query(shapely.point_on_surface(faces), predicate='within')
    groups = defaultdict(list)
    for face, district in dict(zip(*inside, strict=True)).items():
        if land[face]:
            groups[slugs[district]].append(faces[face])
    districts = {district: shapely.coverage_union_all(groups[district]) for district in slugs}
    return districts, areas, water
