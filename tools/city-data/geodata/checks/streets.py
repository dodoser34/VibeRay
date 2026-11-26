"""Проверки схемы дорог (streets/*.geojson) против ответа Overpass, по которому она собрана.

R1  каждая вершина схемы — узел OSM того же класса (с точностью до округления координат)
R2  дороги OSM внутри районов есть на схеме
R3  дорога лежит в районе, в файл которого записана
"""

from collections import defaultdict
from dataclasses import dataclass

import numpy as np
import shapely
from shapely import STRtree

from build_streets import COORD_DIGITS, OUTSIDE
from geodata.checks.city import City
from geodata.checks.measure import SEED, distances, polylines, sample_along
from geodata.checks.report import Report
from geodata.output import read_json
from geodata.paths import CACHE
from geodata.roads import kind_of

# Дорога на схеме отходит от дороги OSM на допуск упрощения (до 1 м) и округление координат.
STREET_M = 1.5
STREET_SHARE = 0.999
# У самого края района отрезок дороги может числиться за соседом или «вне районов».
EDGE_M = 25.0
# Дорога, по которой идёт граница, лежит на краю своего района.
OWN_DISTRICT_M = 2.0
OWN_SHARE = 0.995
# Сколько узлов OSM берётся на проверку полноты.
SAMPLE = 200_000
SAMPLE_STEP_M = 10.0

# Класс дороги → [(район из имени файла, вершины в градусах)].
Lines = dict[str, list[tuple[str | None, np.ndarray]]]
# Класс дороги → [вершины пути OSM в градусах].
Nodes = dict[str, list[np.ndarray]]


@dataclass
class Streets:
    """Схема дорог города, прочитанная из streets/*.geojson.

    files — районы, для которых есть файл; mislabeled — сколько линий лежит не в файле своего
    района (поле district не совпало с именем файла).
    """

    by_kind: Lines
    files: set[str]
    mislabeled: int


def load_streets(city: City) -> Streets:
    by_kind: Lines = defaultdict(list)
    files: set[str] = set()
    mislabeled = 0
    for path in sorted((city.folder / 'streets').glob('*.geojson')):
        owner = None if path.stem == OUTSIDE else path.stem
        if owner:
            files.add(owner)
        for feature in read_json(path)['features']:
            mislabeled += feature['properties']['district'] != owner
            line = np.array(feature['geometry']['coordinates'], dtype=float)
            by_kind[feature['properties']['kind']].append((owner, line))
    return Streets(by_kind, files, mislabeled)


def osm_road_nodes(city: City) -> Nodes:
    """Пути дорог из сохранённого ответа Overpass (--save-osm): класс → [вершины в градусах]."""
    osm = read_json(CACHE / f'{city.slug}-streets.json')
    nodes: Nodes = defaultdict(list)
    for element in osm['elements']:
        kind = kind_of(element.get('tags', {}))
        geometry = element.get('geometry')
        if kind and geometry and len(geometry) > 1:
            nodes[kind].append(np.array([(node['lon'], node['lat']) for node in geometry]))
    return nodes


def check_streets(city: City, report: Report) -> Streets:
    streets = load_streets(city)
    nodes = osm_road_nodes(city)
    check_vertices(streets, nodes, report)
    check_completeness(city, streets, nodes, report)
    check_districts(city, streets, report)
    return streets


def keys(scaled: np.ndarray) -> np.ndarray:
    """Вершина (в целых единицах последнего знака координат схемы) как одно число."""
    unit = 10**COORD_DIGITS
    return (scaled[:, 0] + 180 * unit) * (400 * unit) + scaled[:, 1] + 90 * unit


def node_keys(lon_lat: np.ndarray) -> np.ndarray:
    """Узлы OSM (7 знаков) в координатах схемы (6 знаков).

    Берутся оба соседних значения по каждой оси: округление половинок у разных программ идёт
    в разные стороны.
    """
    low = np.floor(lon_lat * 10**COORD_DIGITS).astype(np.int64)
    return np.concatenate([keys(low + shift) for shift in ([0, 0], [0, 1], [1, 0], [1, 1])])


def check_vertices(streets: Streets, nodes: Nodes, report: Report) -> None:
    total = stray = 0
    for kind, lines in streets.by_kind.items():
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


def check_completeness(city: City, streets: Streets, nodes: Nodes, report: Report) -> None:
    """Случайные узлы дорог OSM внутри районов (не у самого края) должны лежать на схеме."""
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
        own = [city.xy(line) for _, line in streets.by_kind.get(kind, [])]
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


def check_districts(city: City, streets: Streets, report: Report) -> None:
    """Точки вдоль линий должны лежать в районе из имени файла (или вне районов).

    Отрезок относится к району своей середины, поэтому длинный отрезок на краю частично выходит
    за район — отсюда допуск.
    """
    by_owner: dict[str | None, list[np.ndarray]] = defaultdict(list)
    for lines in streets.by_kind.values():
        for owner, line in lines:
            by_owner[owner].append(city.xy(line))
    index = {slug: position for position, slug in enumerate(city.slugs)}
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
    unknown = sorted(streets.files - set(city.slugs))
    share = 1 - astray / max(count, 1)
    measured = f'{share:.3%} длины дорог — в своём районе'
    if unknown:
        measured += f'; файлы несуществующих районов: {", ".join(unknown)}'
    if streets.mislabeled:
        measured += f'; {streets.mislabeled} линий с чужим district'
    report.add(
        'R3',
        f'дорога лежит в своём районе ({count} точек через {SAMPLE_STEP_M:g} м)',
        measured,
        f'≥ {OWN_SHARE:.1%}, чужих файлов нет',
        share >= OWN_SHARE and not unknown and not streets.mislabeled,
    )
