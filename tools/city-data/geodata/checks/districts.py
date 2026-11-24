"""Проверки районов.

D1  состав: районы те же, что в cities.py, у всех есть названия
D2  геометрия: MultiPolygon, валидные полигоны, замкнутые кольца, всё в рамке города
D3  районы не налезают друг на друга и за границу города (официальную с правками cities.py);
    вся суша города — в районах
D4  каждые 10 м границы района лежат на линии OSM (или берегу, ручной прямой, правке чистки);
    официальная граница OSM повторена районами
D5  вершина района, лежащая на ребре соседа, есть и у соседа
"""

from collections import defaultdict
from dataclasses import dataclass

import numpy as np
import shapely
from shapely import STRtree

from geodata.checks.city import ADDED_EDITS, ALL_EDITS, REMOVED_EDITS, City
from geodata.checks.measure import distances, rings_of, sample_along, segments, tree_of
from geodata.checks.report import Report
from geodata.districts.finish import MIN_PART_M2
from geodata.districts.official import apply_manual_edits, relation_areas
from geodata.geometry import parts
from geodata.osm import find_relations, official_boundaries
from geodata.output import read_json
from geodata.paths import CACHE
from geodata.roads import kind_of

ON_LINE_M = 0.5  # граница района «лежит на линии OSM»
SAMPLE_STEP_M = 10.0  # шаг точек вдоль границ
COVER_SHARE = 0.0001  # непокрытая суша города: доля его площади
SHARED_VERTEX_M = 0.02  # вершина «лежит на ребре соседа»


@dataclass
class Territory:
    """Территория официального города в метрах: какой она должна быть на карте (отношения OSM
    с ручными правками cities.py — bays, fills, drops) и где правки её изменили."""

    area: object
    changed: object


def check_districts(city: City, report: Report) -> None:
    check_composition(city, report)
    check_geometry(city, report)
    territory = official_territory(city) if city.is_official else None
    islets = check_coverage(city, report, territory)
    check_boundaries(city, report, islets, territory)
    check_shared_vertices(city, report)


def official_territory(city: City) -> Territory:
    raw = relation_areas(city.slug, city.config, city.lat0)
    edited = apply_manual_edits(dict(raw), city.config)
    changed = [shapely.symmetric_difference(raw[slug], edited[slug]) for slug in raw]
    return Territory(
        area=city.metric(shapely.union_all(list(edited.values()))),
        changed=city.metric(shapely.union_all(changed)),
    )


def check_composition(city: City, report: Report) -> None:
    extra = sorted(set(city.slugs) - set(city.expected))
    missing = sorted(set(city.expected) - set(city.slugs))
    nameless = [
        f['properties']['slug']
        for f in city.collection['features']
        if not f['properties'].get('name') or not f['properties'].get('name_en')
    ]
    problems = [*(f'лишний {s}' for s in extra), *(f'нет {s}' for s in missing)]
    problems += [f'без названия {s}' for s in nameless]
    if len(set(city.slugs)) != len(city.slugs):
        problems.append('повторы slug')
    measured = f'{len(city.slugs)} районов' + (f' ({"; ".join(problems)})' if problems else '')
    report.add('D1', 'состав районов', measured, f'ровно {len(city.expected)}', not problems)


def check_geometry(city: City, report: Report) -> None:
    west, south, east, north = city.info['bbox']
    errors = []
    features = city.collection['features']
    for slug, feature, geometry in zip(city.slugs, features, city.raw, strict=True):
        if feature['geometry']['type'] != 'MultiPolygon':
            errors.append(f'{slug}: не MultiPolygon')
        if not geometry.is_valid:
            errors.append(f'{slug}: {shapely.is_valid_reason(geometry)}')
        for polygon in feature['geometry']['coordinates']:
            for ring in polygon:
                if len(ring) < 4 or ring[0] != ring[-1]:
                    errors.append(f'{slug}: кольцо не замкнуто')
                if any(a == b for a, b in zip(ring, ring[1:], strict=False)):
                    errors.append(f'{slug}: повтор вершины подряд')
                if not all(west <= x <= east and south <= y <= north for x, y in ring):
                    errors.append(f'{slug}: вершина вне рамки города [lon, lat]')
    lon, lat = city.info['center']
    if not (west < lon < east and south < lat < north):
        errors.append('центр города вне рамки')
    examples = f': {"; ".join(sorted(set(errors))[:4])}' if errors else ''
    report.add('D2', 'геометрия районов', f'{len(errors)} ошибок{examples}', '0 ошибок', not errors)


def official_relations(city: City) -> dict[str, dict]:
    osm = official_boundaries(city.slug, city.config['query'])
    return find_relations(osm, city.config['districts'])


def check_coverage(city: City, report: Report, territory: Territory | None) -> list:
    """Наложения и покрытие. Возвращает островки, которые по правилу сборки в районы не входят."""
    tree = STRtree(city.districts)
    pairs = zip(*tree.query(city.districts, predicate='intersects'), strict=True)
    shared = [city.districts[a].intersection(city.districts[b]) for a, b in pairs if a < b]
    report.add_overlap('D3', 'наложение районов друг на друга', shared)
    if not city.is_official:
        holes = [shapely.Polygon(hole) for part in parts(city.union) for hole in part.interiors]
        land = shapely.union_all(holes).difference(city.water) if holes else shapely.Polygon()
        report.add(
            'D3',
            'пустая земля внутри города (кварталы, не вошедшие в районы)',
            f'{land.area / 1e4:.1f} га',
            '',
            None,
        )
        return []

    official = territory.area
    beyond = city.union.difference(official).difference(city.edited(ADDED_EDITS, ON_LINE_M))
    title = 'районы за границей города (официальной, с правками cities.py; кроме заливок чистки)'
    report.add_overlap('D3', title, [beyond])
    empty = official.difference(city.union).difference(city.water)
    bare = parts(empty.difference(city.edited(REMOVED_EDITS, ON_LINE_M)))
    islets = [piece for piece in bare if piece.area < MIN_PART_M2]
    rest = sum(piece.area for piece in bare if piece.area >= MIN_PART_M2)
    share = rest / official.area
    report.add(
        'D3',
        'суша города, не вошедшая в районы (кроме срезов чистки)',
        f'{rest:.1f} м² ({share:.5%} территории)',
        f'≤ {COVER_SHARE:.2%}',
        share <= COVER_SHARE,
    )
    report.add(
        'D3',
        f'островки и щепки суши меньше {MIN_PART_M2 / 1e4:g} га (в районы не входят)',
        f'{len(islets)} шт., {sum(p.area for p in islets) / 1e4:.1f} га',
        '',
        None,
    )
    return islets


def reference_lines(city: City) -> tuple[list[np.ndarray], dict[str, list]]:
    """Линии, на которых должны лежать границы районов: (официальные границы OSM,
    все линии по видам)."""
    kinds: dict[str, list] = defaultdict(list)
    official: list[np.ndarray] = []
    if city.is_official:
        for relation in official_relations(city).values():
            for member in relation['members']:
                geometry = member.get('geometry') or []
                if member['type'] == 'way' and len(geometry) > 1:
                    lon_lat = np.array([(node['lon'], node['lat']) for node in geometry])
                    official.append(city.xy(lon_lat))
        kinds['официальная граница'] = official
        manual = [bay['chord'] for bay in city.config.get('bays', [])]
        manual += [fill['line'] for fill in city.config.get('fills', [])]
        if manual:
            kinds['прямая по разметке (вручную)'] = [city.xy(np.array(line)) for line in manual]
    else:
        # Линии OSM, по которым build_districts.py резал город на кварталы (кеш сборки).
        osm = read_json(CACHE / f'{city.slug}-lines.json')
        for tags, line in city.ways(osm):
            kind = None if tags.get('service') else kind_of(tags)
            if kind in ('major', 'secondary', 'tertiary'):
                kinds['магистраль'].append(line)
            elif kind == 'local':
                kinds['улица'].append(line)
            elif tags.get('railway'):
                kinds['железная дорога'].append(line)
            elif tags.get('highway'):
                kinds['проезд, тропа'].append(line)
            else:
                kinds['контур участка, ограда, водоток'].append(line)
        closures = city.config.get('closures', [])
        if closures:
            kinds['замыкающий отрезок (вручную)'] = [city.xy(np.array(c)) for c in closures]
    kinds['берег'] = [np.asarray(ring.coords) for ring in rings_of(city.water)]
    edits = [piece for kind in ALL_EDITS for piece in city.edits.get(kind, [])]
    if edits:
        kinds['правка чистки контуров'] = [
            np.asarray(ring.coords) for piece in edits for ring in rings_of(piece)
        ]
    return official, kinds


def check_boundaries(city: City, report: Report, islets: list, territory: Territory | None) -> None:
    official, kinds = reference_lines(city)
    lines = [line for group in kinds.values() for line in group]
    outlines = [np.asarray(ring.coords) for g in city.districts for ring in rings_of(g)]
    points = sample_along(outlines, SAMPLE_STEP_M)
    off = distances(tree_of(lines), points)
    bad = int((off > ON_LINE_M).sum())
    report.add(
        'D4',
        f'границы районов на линиях OSM ({len(points)} точек через {SAMPLE_STEP_M:g} м)',
        f'{bad} вне линий, макс. отклонение {off.max():.3f} м',
        f'≤ {ON_LINE_M} м, все точки',
        bad == 0,
    )
    report.add('D4', 'по чему идут границы районов', boundary_makeup(kinds, points), '', None)
    if official:
        check_official_line(city, report, official, outlines, islets, territory)


def boundary_makeup(kinds: dict[str, list], points: np.ndarray) -> str:
    """Из чего состоит граница: каждая точка — виду ближайшей линии."""
    best = np.full(len(points), np.inf)
    owner = np.zeros(len(points), dtype=int)
    names = list(kinds)
    for index, name in enumerate(names):
        found = distances(tree_of(kinds[name]), points)
        closer = found < best - 1e-6
        owner[closer] = index
        best[closer] = found[closer]
    shares = [(float((owner == i).mean()), name) for i, name in enumerate(names)]
    return ', '.join(f'{name} {share:.0%}' for share, name in sorted(shares, reverse=True) if share)


def check_official_line(
    city: City,
    report: Report,
    official: list,
    outlines: list,
    islets: list,
    territory: Territory,
) -> None:
    """Официальная граница OSM повторена районами, кроме мест, где её на карте быть не должно:
    вода, мелкие островки, ручные правки cities.py и правки чистки контуров."""
    samples = sample_along(official, SAMPLE_STEP_M)
    points = shapely.points(samples)
    missed = distances(tree_of(outlines), samples) > ON_LINE_M
    excused = np.zeros(len(samples), dtype=bool)
    for area in (city.water, shapely.union_all(islets), territory.changed):
        if not area.is_empty:
            excused |= shapely.contains(shapely.buffer(area, ON_LINE_M), points)
    excused |= shapely.contains(city.edited(ALL_EDITS, ON_LINE_M), points)
    lost = int((missed & ~excused).sum())
    report.add(
        'D4',
        f'официальная граница OSM повторена районами ({len(samples)} точек)',
        f'{lost} точек границы нет на карте (вне воды, островков, ручных правок и чистки)',
        f'≤ {ON_LINE_M} м, все точки',
        lost == 0,
    )


def check_shared_vertices(city: City, report: Report) -> None:
    """Вершина одного района, лежащая на ребре другого, должна быть и его вершиной."""
    rings = [
        (d, np.asarray(ring.coords)) for d, g in enumerate(city.districts) for ring in rings_of(g)
    ]
    edges = segments([ring for _, ring in rings])
    edge_owner = np.concatenate([np.full(len(ring) - 1, d) for d, ring in rings])
    vertices = np.concatenate([ring[:-1] for _, ring in rings])
    vertex_owner = np.concatenate([np.full(len(ring) - 1, d) for d, ring in rings])
    tree = STRtree(shapely.linestrings(edges))
    vertex, edge = tree.query(
        shapely.points(vertices), predicate='dwithin', distance=SHARED_VERTEX_M
    )
    other = vertex_owner[vertex] != edge_owner[edge]
    vertex, edge = vertex[other], edge[other]
    to_ends = np.minimum(
        np.hypot(*(vertices[vertex] - edges[edge, 0]).T),
        np.hypot(*(vertices[vertex] - edges[edge, 1]).T),
    )
    loose = int((to_ends > SHARED_VERTEX_M).sum())
    report.add(
        'D5',
        f'общие границы соседей из одних вершин ({len(vertex)} стыков вершина — ребро)',
        f'{loose} вершин без пары у соседа',
        '0',
        loose == 0,
    )
