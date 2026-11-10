"""Проверка геоданных города против сырого OpenStreetMap: районы, дороги, вода, плитки.

Сверяет готовые файлы (backend/data/cities/<slug>/, копию в демо-данных фронтенда и плитки
frontend/public/maps/<slug>/) с ответами Overpass из backend/.osm-cache/ — теми же, по которым
build_districts.py и build_streets.py (--save-osm) собирали город; ответа с водой в кеше нет —
он скачивается. Печатает таблицу «проверка — измерено — порог» и вердикт; код выхода 1, если хотя
бы одна проверка не прошла. Нужны shapely (requirements-dev.txt) и Pillow.

    D1 состав районов            D4 границы лежат на линиях OSM     R1 вершины дорог — узлы OSM
    D2 геометрия                 D5 общая граница — общие вершины   R2 дороги OSM есть на схеме
    D3 наложения и покрытие      W1 вода и районы, берега OSM       R3 дорога лежит в своём районе
    T1 плитки и векторные куски  C1 копии бэкенда и фронтенда

Запуск из корня репозитория:

    python backend/scripts/verify_city_data.py kostanay
    python backend/scripts/verify_city_data.py --all --report docs/MAP_VERIFICATION.md
"""

import argparse
import json
import math
import random
from collections import defaultdict
from datetime import date
from pathlib import Path

import numpy as np
import shapely
from build_districts import (
    CACHE,
    CITIES,
    DATA,
    DEMO,
    MIN_PART_M2,
    cached,
    close_bay,
    parts,
    relation_area,
)
from build_map_tiles import FINEST_MPP, OUT, ROADS, TILE_PX, VECTOR_UNIT_M
from build_streets import COORD_DIGITS, kind_of, overpass
from PIL import Image
from shapely import STRtree
from shapely.geometry import shape

METERS_PER_DEGREE = 111_320

ON_LINE_M = 0.5  # граница района «лежит на линии OSM»
SAMPLE_STEP_M = 10.0  # шаг точек вдоль границ
STREET_M = 1.5  # дорога на схеме от дороги OSM: упрощение до 1 м + округление координат
STREET_SHARE = 0.999
EDGE_M = 25.0  # у самого края района отрезок дороги может числиться за соседом или «вне районов»
OWN_DISTRICT_M = 2.0  # дорога, по которой идёт граница, лежит на краю своего района
OWN_SHARE = 0.995
SHORE_M = 3.0  # берег в water.geojson от берега OSM: упрощение 2,5 м + округление
SHORE_NEAR_M = 5.0  # берега «у районов» — ближе этого к плитке района
SHORE_SHARE = 0.99
RIBBON_M = 32.0  # русло, у которого в OSM есть только ось: лента 64 м (ARCHITECTURE.md 5.1)
COVER_SHARE = 0.0001  # непокрытая суша города: доля его площади
OVERLAP_M = 0.1  # наложение (районов друг на друга, на воду, за черту города) не шире этого:
# узлы сети лежат на сетке координат 1e-7° (~1 см), и вдоль общей линии остаются волосяные щепки
TILE_SHARE = 0.995
VECTOR_M = 0.2
SAMPLE = 200_000  # точек OSM на проверку полноты дорог
TILE_SAMPLE = 2_000
SEED = 20261110

WATER_QUERY = (
    '(way["natural"~"^(water|coastline)$"]({box});way["waterway"~"^(riverbank|dock)$"]({box});'
    'way["landuse"~"^(reservoir|basin)$"]({box});relation["natural"="water"]({box});'
    'relation["waterway"="riverbank"]({box});relation["landuse"~"^(reservoir|basin)$"]({box});'
    ')->.a;(way.a;way(r.a);way["waterway"~"^(river|canal|stream)$"]({box}););out tags geom;'
)


class Report:
    def __init__(self, city: str) -> None:
        self.city = city
        self.rows: list[tuple[str, str, str, str, bool | None]] = []

    def add(self, code: str, title: str, measured: str, limit: str, passed: bool | None) -> None:
        """passed=None — справка без порога."""
        self.rows.append((code, title, measured, limit, passed))
        mark = {True: 'OK ', False: 'НЕТ', None: '   '}[passed]
        print(f'  {mark} {code:3} {title}: {measured}' + (f'  [порог: {limit}]' if limit else ''))

    @property
    def accepted(self) -> bool:
        return all(passed is not False for *_, passed in self.rows)


class City:
    """Готовые данные города в метрах локальной проекции (x — восток, y — север)."""

    def __init__(self, slug: str) -> None:
        self.slug = slug
        self.folder = DATA / slug
        self.info = json.loads((self.folder / 'city.json').read_text(encoding='utf-8'))
        self.lat0 = self.info['center'][1]
        self.kx = math.cos(math.radians(self.lat0)) * METERS_PER_DEGREE
        self.ky = METERS_PER_DEGREE
        self.collection = json.loads((self.folder / 'districts.geojson').read_text('utf-8'))
        self.slugs = [f['properties']['slug'] for f in self.collection['features']]
        self.raw = [shape(f['geometry']) for f in self.collection['features']]
        self.districts = [self.metric(g) for g in self.raw]
        water = json.loads((self.folder / 'water.geojson').read_text(encoding='utf-8'))
        self.water_raw = [shape(f['geometry']) for f in water['features']]
        self.water_parts = [self.metric(shapely.make_valid(g)) for g in self.water_raw]
        self.water = shapely.union_all([p for g in self.water_parts for p in parts(g)])
        self.union = shapely.union_all(self.districts)
        self.expected = list(CITIES[slug].get('districts') or CITIES[slug]['blocks'])

    def metric(self, geometry):
        return shapely.transform(geometry, lambda c: c * [self.kx, self.ky])

    def xy(self, lon_lat: np.ndarray) -> np.ndarray:
        return np.asarray(lon_lat, dtype=float) * [self.kx, self.ky]


def rings_of(geometry) -> list:
    return [ring for part in parts(geometry) for ring in (part.exterior, *part.interiors)]


def segments(lines: list[np.ndarray]) -> np.ndarray:
    """Отрезки полилиний: массив (n, 2, 2)."""
    chunks = [np.stack([line[:-1], line[1:]], axis=1) for line in lines if len(line) > 1]
    return np.concatenate(chunks) if chunks else np.empty((0, 2, 2))


def tree_of(lines: list[np.ndarray]) -> STRtree:
    return STRtree(shapely.linestrings(segments(lines)))


def distances(tree: STRtree, points: np.ndarray) -> np.ndarray:
    """Расстояние от каждой точки до ближайшего отрезка дерева."""
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


def polylines(lines: list[np.ndarray]) -> list:
    return [shapely.LineString(line) for line in lines if len(line) > 1]


def sample_along(lines: list[np.ndarray], step: float) -> np.ndarray:
    """Вершины полилиний и точки между ними не реже шага."""
    return shapely.get_coordinates(shapely.segmentize(polylines(lines), step))


def ways_of(osm: dict, city: City) -> list[tuple[dict, np.ndarray]]:
    """Пути ответа Overpass: (теги, вершины в метрах)."""
    result = []
    for element in osm['elements']:
        geometry = element.get('geometry')
        if element['type'] == 'way' and geometry and len(geometry) > 1:
            lon_lat = np.array([(node['lon'], node['lat']) for node in geometry])
            result.append((element.get('tags', {}), city.xy(lon_lat)))
    return result


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
    for slug, feature, geometry in zip(
        city.slugs, city.collection['features'], city.raw, strict=True
    ):
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
                inside = all(west <= x <= east and south <= y <= north for x, y in ring)
                if not inside:
                    errors.append(f'{slug}: вершина вне рамки города [lon, lat]')
    lon, lat = city.info['center']
    if not (west < lon < east and south < lat < north):
        errors.append('центр города вне рамки')
    measured = f'{len(errors)} ошибок' + (
        f': {"; ".join(sorted(set(errors))[:4])}' if errors else ''
    )
    report.add('D2', 'геометрия районов', measured, '0 ошибок', not errors)


def check_coverage(city: City, report: Report) -> list:
    """Наложения и покрытие. Возвращает островки, которые по правилу сборки в районы не входят."""
    tree = STRtree(city.districts)
    pairs = zip(*tree.query(city.districts, predicate='intersects'), strict=True)
    shared = [city.districts[a].intersection(city.districts[b]) for a, b in pairs if a < b]
    add_overlap(report, 'D3', 'наложение районов друг на друга', shared)
    if 'districts' not in CITIES[city.slug]:
        holes = [shapely.Polygon(ring) for ring in parts_holes(city.union)]
        land = shapely.union_all(holes).difference(city.water) if holes else shapely.Polygon()
        report.add(
            'D3',
            'пустая земля внутри города (кварталы, не вошедшие в районы)',
            f'{land.area / 1e4:.1f} га',
            '',
            None,
        )
        return []

    osm = json.loads((CACHE / f'{city.slug}-boundaries.json').read_text(encoding='utf-8'))
    names = set(CITIES[city.slug]['districts'].values())
    relations = [
        e for e in osm['elements'] if e['type'] == 'relation' and e['tags'].get('name') in names
    ]
    official = shapely.union_all([city.metric(relation_area(r, city.lat0)) for r in relations])
    add_overlap(report, 'D3', 'районы за официальной границей', [city.union.difference(official)])
    bare = parts(official.difference(city.union).difference(city.water))
    islets = [piece for piece in bare if piece.area < MIN_PART_M2]
    rest = sum(piece.area for piece in bare if piece.area >= MIN_PART_M2)
    share = rest / official.area
    report.add(
        'D3',
        'суша города, не вошедшая в районы',
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


def add_overlap(report: Report, code: str, title: str, overlaps: list) -> None:
    """Наложение засчитывается, если оно где-то шире OVERLAP_M (не исчезает при сжатии)."""
    area = sum(piece.area for piece in overlaps)
    wide = sum(not shapely.buffer(piece, -OVERLAP_M / 2).is_empty for piece in overlaps)
    measured = f'{wide} мест шире {OVERLAP_M} м (волосяных щепок на {area:.2f} м²)'
    report.add(code, title, measured, f'нигде не шире {OVERLAP_M} м', wide == 0)


def parts_holes(geometry) -> list:
    return [hole for part in parts(geometry) for hole in part.interiors]


def reference_lines(city: City) -> tuple[list[np.ndarray], list[np.ndarray], dict[str, list]]:
    """Линии OSM, на которых должны лежать границы: (все, официальные границы, по видам)."""
    kinds: dict[str, list] = defaultdict(list)
    official: list[np.ndarray] = []
    if 'districts' in CITIES[city.slug]:
        osm = json.loads((CACHE / f'{city.slug}-boundaries.json').read_text(encoding='utf-8'))
        names = set(CITIES[city.slug]['districts'].values())
        for relation in osm['elements']:
            if relation['type'] != 'relation' or relation['tags'].get('name') not in names:
                continue
            for member in relation['members']:
                geometry = member.get('geometry') or []
                if member['type'] == 'way' and len(geometry) > 1:
                    lon_lat = np.array([(node['lon'], node['lat']) for node in geometry])
                    official.append(city.xy(lon_lat))
        kinds['официальная граница'] = official
        chords = [city.xy(np.array(bay['chord'])) for bay in CITIES[city.slug].get('bays', [])]
        if chords:
            kinds['хорда залива (вручную)'] = chords
    else:
        osm = json.loads((CACHE / f'{city.slug}-lines.json').read_text(encoding='utf-8'))
        for tags, line in ways_of(osm, city):
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
        closures = CITIES[city.slug].get('closures', [])
        if closures:
            kinds['замыкающий отрезок (вручную)'] = [city.xy(np.array(c)) for c in closures]
    shore = [np.asarray(ring.coords) for part in parts(city.water) for ring in rings_of(part)]
    kinds['берег'] = shore
    return [line for lines in kinds.values() for line in lines], official, kinds


def bays_of(city: City) -> list:
    """Заливы, закрытые хордой (CITIES[...]['bays']): их официальная граница на карте не нужна."""
    bays = CITIES[city.slug].get('bays', [])
    if not bays:
        return []
    osm = json.loads((CACHE / f'{city.slug}-boundaries.json').read_text(encoding='utf-8'))
    by_name = {e['tags'].get('name'): e for e in osm['elements'] if e['type'] == 'relation'}
    names = CITIES[city.slug]['districts']
    result = []
    for bay in bays:
        areas = {s: relation_area(by_name[names[s]], city.lat0) for s in (bay['from'], bay['to'])}
        before = areas[bay['from']]
        close_bay(areas, bay)
        result.append(city.metric(before.difference(areas[bay['from']])))
    return result


def check_boundaries(city: City, report: Report, islets: list) -> None:
    lines, official, kinds = reference_lines(city)
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

    # Из чего состоит граница: каждая точка — виду ближайшей линии.
    best = np.full(len(points), np.inf)
    owner = np.zeros(len(points), dtype=int)
    names = list(kinds)
    for index, name in enumerate(names):
        found = distances(tree_of(kinds[name]), points)
        closer = found < best - 1e-6
        owner[closer] = index
        best[closer] = found[closer]
    shares = [(float((owner == i).mean()), name) for i, name in enumerate(names)]
    text = ', '.join(f'{name} {share:.0%}' for share, name in sorted(shares, reverse=True) if share)
    report.add('D4', 'по чему идут границы районов', text, '', None)

    if official:
        samples = sample_along(official, SAMPLE_STEP_M)
        missed = distances(tree_of(outlines), samples) > ON_LINE_M
        wet = shapely.contains(shapely.buffer(city.water, ON_LINE_M), shapely.points(samples))
        for skipped in (islets, bays_of(city)):
            if skipped:
                near = shapely.buffer(shapely.union_all(skipped), ON_LINE_M)
                wet |= shapely.contains(near, shapely.points(samples))
        lost = int((missed & ~wet).sum())
        report.add(
            'D4',
            f'официальная граница OSM повторена районами ({len(samples)} точек)',
            f'{lost} точек границы нет на карте (вне воды, островков и заливов)',
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
    eps = 0.02
    pairs = tree.query(shapely.points(vertices), predicate='dwithin', distance=eps)
    vertex, edge = pairs[0], pairs[1]
    other = vertex_owner[vertex] != edge_owner[edge]
    vertex, edge = vertex[other], edge[other]
    to_ends = np.minimum(
        np.hypot(*(vertices[vertex] - edges[edge, 0]).T),
        np.hypot(*(vertices[vertex] - edges[edge, 1]).T),
    )
    loose = int((to_ends > eps).sum())
    report.add(
        'D5',
        f'общие границы соседей из одних вершин ({len(vertex)} стыков вершина — ребро)',
        f'{loose} вершин без пары у соседа',
        '0',
        loose == 0,
    )


def check_water(city: City, report: Report) -> None:
    tree = STRtree(city.water_parts)
    pairs = zip(*tree.query(city.districts, predicate='intersects'), strict=True)
    add_overlap(
        report,
        'W1',
        'наложение районов на воду',
        [city.districts[d].intersection(city.water_parts[w]) for d, w in pairs],
    )

    west, south, east, north = city.info['bbox']
    box = f'{south - 0.01},{west - 0.01},{north + 0.01},{east + 0.01}'
    osm = cached(
        CACHE / f'{city.slug}-water.json',
        lambda: overpass('[out:json][timeout:300];' + WATER_QUERY.format(box=box)),
    )
    shores, axes = [], []
    for tags, line in ways_of(osm, city):
        (axes if tags.get('waterway') in ('river', 'canal', 'stream') else shores).append(line)
    rings = [np.asarray(ring.coords) for g in city.water_parts for ring in rings_of(g)]
    vertices = np.concatenate([ring[:-1] for ring in rings])
    near = distances(
        tree_of([np.asarray(r.coords) for g in city.districts for r in rings_of(g)]), vertices
    )
    vertices = vertices[near <= SHORE_NEAR_M]
    off = distances(tree_of(shores), vertices)
    good = off <= SHORE_M
    # Русло без площади в OSM нарисовано лентой вокруг осевой линии.
    ribbon = np.abs(distances(tree_of(axes), vertices) - RIBBON_M) <= SHORE_M
    share = float((good | ribbon).mean()) if len(vertices) else 1.0
    report.add(
        'W1',
        f'берега у районов на берегах OSM ({len(vertices)} вершин воды)',
        f'{share:.2%} (из них лента вдоль оси русла {float((~good & ribbon).mean()):.2%})',
        f'≥ {SHORE_SHARE:.0%} не дальше {SHORE_M:g} м',
        share >= SHORE_SHARE,
    )


def load_streets(city: City) -> dict[str, list[tuple[str | None, np.ndarray]]]:
    """Схема дорог: вид → [(район из файла, вершины в градусах)]."""
    by_kind: dict[str, list] = defaultdict(list)
    names = set()
    wrong = 0
    for path in sorted((city.folder / 'streets').glob('*.geojson')):
        names.add(path.stem)
        owner = None if path.stem == '_outside' else path.stem
        for feature in json.loads(path.read_text(encoding='utf-8'))['features']:
            wrong += feature['properties']['district'] != owner
            line = np.array(feature['geometry']['coordinates'], dtype=float)
            by_kind[feature['properties']['kind']].append((owner, line))
    city.street_files = names - {'_outside'}
    city.street_mislabeled = wrong
    return by_kind


def keys(scaled: np.ndarray) -> np.ndarray:
    """Вершина (целые единицы последнего знака координат схемы) как одно число."""
    unit = 10**COORD_DIGITS
    return (scaled[:, 0] + 180 * unit) * (400 * unit) + scaled[:, 1] + 90 * unit


def node_keys(lon_lat: np.ndarray) -> np.ndarray:
    """Узлы OSM (7 знаков) в координатах схемы (6 знаков): оба соседних значения по каждой оси —
    округление половинок у разных программ идёт в разные стороны."""
    low = np.floor(lon_lat * 10**COORD_DIGITS).astype(np.int64)
    return np.concatenate([keys(low + shift) for shift in ([0, 0], [0, 1], [1, 0], [1, 1])])


def check_streets(city: City, report: Report) -> dict:
    streets = load_streets(city)
    osm = json.loads((CACHE / f'{city.slug}-streets.json').read_text(encoding='utf-8'))
    nodes: dict[str, list[np.ndarray]] = defaultdict(list)
    for element in osm['elements']:
        kind = kind_of(element.get('tags', {}))
        geometry = element.get('geometry')
        if kind and geometry and len(geometry) > 1:
            nodes[kind].append(np.array([(node['lon'], node['lat']) for node in geometry]))
    del osm

    total = stray = 0
    for kind, lines in streets.items():
        own = np.concatenate([line for _, line in lines])
        own = keys(np.round(own * 10**COORD_DIGITS).astype(np.int64))
        known = node_keys(np.concatenate(nodes[kind])) if nodes[kind] else np.empty(0, np.int64)
        total += len(own)
        stray += int((~np.isin(own, known)).sum())
    report.add(
        'R1',
        f'вершины схемы дорог — узлы OSM того же класса ({total} вершин)',
        f'{stray} вершин не из OSM (остальные — узел OSM с точностью до округления, ≤ 0,1 м)',
        'все вершины',
        stray == 0,
    )

    # Полнота: узлы дорог OSM внутри районов (не у самого края) должны лежать на схеме.
    rng = np.random.default_rng(SEED)
    inner = shapely.buffer(city.union, -EDGE_M)
    shapely.prepare(inner)
    checked = missing = 0
    worst = 0.0
    all_nodes = sum(len(line) for lines in nodes.values() for line in lines)
    for kind, lines in nodes.items():
        points = city.xy(np.concatenate(lines))
        take = max(1, round(SAMPLE * len(points) / all_nodes))
        if len(points) > take:
            points = points[rng.choice(len(points), take, replace=False)]
        points = points[shapely.contains_xy(inner, points[:, 0], points[:, 1])]
        if not len(points):
            continue
        own = [city.xy(line) for _, line in streets.get(kind, [])]
        off = distances(STRtree(polylines(own)), points)
        checked += len(points)
        missing += int((off > STREET_M).sum())
        worst = max(worst, float(np.percentile(off, 99.9)))
    share = 1 - missing / max(checked, 1)
    report.add(
        'R2',
        f'дороги OSM внутри районов есть на схеме ({checked} узлов OSM)',
        f'{share:.3%} не дальше {STREET_M} м; 99,9 % узлов — в {worst:.2f} м',
        f'≥ {STREET_SHARE:.1%}',
        share >= STREET_SHARE,
    )

    # Привязка к району: точки вдоль линий — в районе из имени файла (или вне районов). Отрезок
    # относится к району своей середины, поэтому длинный отрезок на краю частично выходит за него.
    by_owner: dict[str | None, list[np.ndarray]] = defaultdict(list)
    for lines in streets.values():
        for owner, line in lines:
            by_owner[owner].append(city.xy(line))
    index = {slug: i for i, slug in enumerate(city.slugs)}
    count = astray = 0
    for owner, lines in by_owner.items():
        points = sample_along(lines, SAMPLE_STEP_M)
        count += len(points)
        if owner is None:
            deep = shapely.buffer(city.union, -OWN_DISTRICT_M)
            shapely.prepare(deep)
            astray += int(shapely.contains_xy(deep, points[:, 0], points[:, 1]).sum())
        elif owner in index:
            home = shapely.buffer(city.districts[index[owner]], OWN_DISTRICT_M)
            shapely.prepare(home)
            astray += int((~shapely.contains_xy(home, points[:, 0], points[:, 1])).sum())
        else:
            astray += len(points)
    unknown = sorted(city.street_files - set(city.slugs))
    share = 1 - astray / max(count, 1)
    measured = f'{share:.3%} длины дорог — в своём районе'
    if unknown:
        measured += f'; файлы несуществующих районов: {", ".join(unknown)}'
    if city.street_mislabeled:
        measured += f'; {city.street_mislabeled} линий с чужим district'
    passed = share >= OWN_SHARE and not unknown and not city.street_mislabeled
    report.add(
        'R3',
        f'дорога лежит в своём районе ({count} точек через {SAMPLE_STEP_M:g} м)',
        measured,
        f'≥ {OWN_SHARE:.1%}, чужих файлов нет',
        passed,
    )
    return streets


def check_tiles(city: City, report: Report, streets: dict) -> None:
    folder = OUT / city.slug
    manifest = json.loads((folder / 'tiles.json').read_text(encoding='utf-8'))
    same_center = manifest['center'] == city.info['center']
    report.add(
        'T1',
        'центр плиток = центр города',
        f'{manifest["center"]} и {city.info["center"]}',
        'совпадают',
        same_center,
    )

    lon0, lat0 = manifest['center']
    scale = np.array([math.cos(math.radians(lat0)) * METERS_PER_DEGREE, METERS_PER_DEGREE]) / 1000
    channel_of = {kind: 'RGB'.index(channel) for kind, channel, *_ in ROADS}
    rng = random.Random(SEED)
    samples = []  # (вид, точка в км от центра)
    for kind, lines in streets.items():
        if (
            kind == 'rail' or kind not in channel_of
        ):  # железная дорога — пунктир: точка может попасть в пробел
            continue
        for owner, line in lines:
            if owner is not None:
                middle = line[len(line) // 2]
                samples.append((kind, (middle - [lon0, lat0]) * scale))
    samples = rng.sample(samples, min(TILE_SAMPLE, len(samples)))

    tile_km = TILE_PX * FINEST_MPP / 1000
    level = manifest['levels'][0]
    have = {tuple(tile) for tile in level['tiles']}
    cells = {tuple(cell) for cell in manifest['vector']}
    images: dict[tuple[int, int], np.ndarray] = {}
    chunks: dict[tuple[int, int], dict] = {}
    painted = traced = 0
    for kind, (x, y) in samples:
        tile = (math.floor(x / tile_km), math.floor(y / tile_km))
        if tile in have:
            if tile not in images:
                path = folder / '0' / f'{tile[0]}_{tile[1]}.{manifest["format"]}'
                images[tile] = np.asarray(Image.open(path).convert('RGB'))
            col = min(TILE_PX - 1, int((x - tile[0] * tile_km) * 1000 / FINEST_MPP))
            row = min(TILE_PX - 1, int(((tile[1] + 1) * tile_km - y) * 1000 / FINEST_MPP))
            window = images[tile][
                max(row - 1, 0) : row + 2, max(col - 1, 0) : col + 2, channel_of[kind]
            ]
            painted += bool(window.max() > 0)
        if tile in cells:
            if tile not in chunks:
                path = folder / 'vector' / f'{tile[0]}_{tile[1]}.json'
                chunks[tile] = json.loads(path.read_text(encoding='utf-8'))
            point = np.array([(x - tile[0] * tile_km), (y - tile[1] * tile_km)]) * 1000
            lines = [
                np.array(flat, dtype=float).reshape(-1, 2) * VECTOR_UNIT_M
                for flat in chunks[tile].get(kind, [])
            ]
            traced += bool(lines and distances(tree_of(lines), point[None])[0] <= VECTOR_M)
    count = max(len(samples), 1)
    report.add(
        'T1',
        f'дороги на плитках {FINEST_MPP:g} м/px ({len(samples)} случайных точек дорог)',
        f'{painted / count:.2%} точек закрашено (точность растра — 1 px)',
        f'≥ {TILE_SHARE:.1%}',
        painted / count >= TILE_SHARE,
    )
    report.add(
        'T1',
        'дороги в векторных кусках (те же точки)',
        f'{traced / count:.2%} не дальше {VECTOR_M} м',
        '100 %',
        traced == len(samples),
    )


def check_copies(city: City, report: Report) -> None:
    differ = [
        name
        for name in ('districts.geojson', 'water.geojson', 'city.json')
        if (city.folder / name).read_bytes() != (DEMO / city.slug / name).read_bytes()
    ]
    report.add(
        'C1',
        'копия для демо-режима фронтенда = данные бэкенда',
        'совпадают' if not differ else f'расходятся: {", ".join(differ)}',
        'побайтно',
        not differ,
    )


def verify(slug: str) -> Report:
    print(f'{slug}')
    city = City(slug)
    report = Report(slug)
    check_composition(city, report)
    check_geometry(city, report)
    islets = check_coverage(city, report)
    check_boundaries(city, report, islets)
    check_shared_vertices(city, report)
    check_water(city, report)
    streets = check_streets(city, report)
    check_tiles(city, report, streets)
    check_copies(city, report)
    print(f'  => {"ПРИНЯТО" if report.accepted else "НЕ ПРИНЯТО"}\n')
    return report


def markdown(reports: list[Report]) -> str:
    verdict = 'ПРИНЯТО' if all(r.accepted for r in reports) else 'НЕ ПРИНЯТО'
    lines = [
        '# Проверка геоданных карты',
        '',
        f'Отчёт `backend/scripts/verify_city_data.py --all` от {date.today().isoformat()}: готовые '
        'файлы городов сверены с сырыми данными OpenStreetMap (ответы Overpass в '
        '`backend/.osm-cache/`). Что означает каждая проверка — ARCHITECTURE.md, раздел 5.3.',
        '',
        f'**Итог: {verdict}.**',
        '',
    ]
    for report in reports:
        lines += [
            f'## {report.city} — {"принято" if report.accepted else "не принято"}',
            '',
            '| | Проверка | Измерено | Порог | Итог |',
            '|---|---|---|---|---|',
        ]
        for code, title, measured, limit, passed in report.rows:
            mark = {True: 'да', False: '**нет**', None: 'справка'}[passed]
            lines.append(f'| {code} | {title} | {measured} | {limit or "—"} | {mark} |')
        lines.append('')
    return '\n'.join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('city', nargs='?', choices=sorted(CITIES), help='slug города')
    parser.add_argument('--all', action='store_true', help='все города')
    parser.add_argument('--report', type=Path, help='записать отчёт (Markdown)')
    args = parser.parse_args()
    if not args.all and not args.city:
        parser.error('укажите город или --all')
    reports = [verify(slug) for slug in (sorted(CITIES) if args.all else [args.city])]
    if args.report:
        args.report.write_text(markdown(reports), encoding='utf-8', newline='\n')
    accepted = all(report.accepted for report in reports)
    print('ИТОГ: ' + ('ПРИНЯТО' if accepted else 'НЕ ПРИНЯТО'))
    raise SystemExit(0 if accepted else 1)


if __name__ == '__main__':
    main()
