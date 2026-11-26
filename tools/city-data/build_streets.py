"""Схема дорог города из OpenStreetMap -> streets/<район>.geojson.

Берёт дороги (от магистралей до дворовых проездов) и железную дорогу через Overpass API, делит их
на классы схемы (geodata/roads.py), разрезает по районам (отрезок относится к району своей
середины) и слегка упрощает. Названий и адресов в результате нет — только рисунок дорог. Лицензия
данных — ODbL.

Пишет backend/data/cities/<slug>/streets/: по файлу на район (<slug района>.geojson) и
_outside.geojson для дорог вне районов; старые файлы папки удаляются. Фронтенд схему не читает:
карта рисует дороги плитками, после этого скрипта их пересобирает build_map_tiles.py.

Ответ Overpass стоит сохранять (--save-osm tools/city-data/.osm-cache/<slug>-streets.json): по нему
verify_city_data.py проверяет, что схема совпадает с OSM, а повторная сборка идёт без сети (--osm).

Запуск из корня репозитория (<кеш> — tools/city-data/.osm-cache/<slug>-streets.json):

    python tools/city-data/build_streets.py kostanay --save-osm <кеш>   # скачать и сохранить
    python tools/city-data/build_streets.py kostanay --osm <кеш>        # пересобрать без сети

Большой город грузится частями, а дворовые проезды за пределами районов не берутся (--save-osm
нужен и здесь):

    python tools/city-data/build_streets.py cologne --tiles 4 --skip-outside service
"""

import argparse
import json
import math
from collections import Counter
from itertools import pairwise
from pathlib import Path
from typing import Any

from geodata.osm import overpass, way_points
from geodata.output import feature_collection, read_json, write_json
from geodata.paths import DATA
from geodata.roads import HIGHWAY_KIND, kind_of

MARGIN_DEG = 0.02  # запас вокруг города, чтобы подложка не обрывалась у края районов
OUTSIDE = '_outside'  # файл дорог вне районов (district = null)
COORD_DIGITS = 6  # ~0,1 м
# Допуск упрощения невелик: дороги лежат на общем слое под районами и должны совпадать с OSM.
TOLERANCE_M = {
    'major': 1.0,
    'secondary': 1.0,
    'tertiary': 0.8,
    'local': 0.6,
    'service': 0.5,
    'rail': 1.0,
}
# Метров в градусе для упрощения линий. Широта — средняя длина градуса; на результат влияет только
# допуск упрощения, а не положение вершин (они остаются узлами OSM).
SIMPLIFY_LON_M = 111_320
SIMPLIFY_LAT_M = 110_540

Point = tuple[float, float]
Ring = list[list[float]]
Run = tuple[str, str | None, list[Point]]  # класс дороги, район, вершины


def fetch(bbox: list[float], tiles: int = 1) -> dict[str, Any]:
    """Дороги в рамке города с запасом.

    Большой город с дворовыми проездами Overpass одним запросом не отдаёт, поэтому рамка режется
    на tiles × tiles частей; путь из нескольких частей берётся один раз.
    """
    west, south = bbox[0] - MARGIN_DEG, bbox[1] - MARGIN_DEG
    east, north = bbox[2] + MARGIN_DEG, bbox[3] + MARGIN_DEG
    step_x, step_y = (east - west) / tiles, (north - south) / tiles
    elements: dict[int, dict[str, Any]] = {}
    for row in range(tiles):
        for col in range(tiles):
            part = fetch_box(
                south + row * step_y,
                west + col * step_x,
                south + (row + 1) * step_y,
                west + (col + 1) * step_x,
            )
            for element in part['elements']:
                elements[element['id']] = element
            done = row * tiles + col + 1
            print(f'Overpass: часть {done} из {tiles * tiles}, путей {len(elements)}')
    return {'elements': list(elements.values())}


def fetch_box(south: float, west: float, north: float, east: float) -> dict[str, Any]:
    box = f'{south},{west},{north},{east}'
    highways = '|'.join(HIGHWAY_KIND)
    return overpass(
        '[out:json][timeout:300];('
        f'way["highway"~"^({highways})$"]({box});'
        f'way["railway"="rail"]({box});'
        ');out tags geom;'
    )


def in_ring(x: float, y: float, ring: Ring) -> bool:
    """Точка внутри кольца (правило чётности пересечений луча)."""
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


class Districts:
    """Районы города для вопроса «в каком районе точка»."""

    def __init__(self, geojson: dict[str, Any]) -> None:
        self.parts: list[tuple[str, list[Ring], tuple[float, float, float, float]]] = []
        for feature in geojson['features']:
            geometry = feature['geometry']
            polygons = (
                geometry['coordinates']
                if geometry['type'] == 'MultiPolygon'
                else [geometry['coordinates']]
            )
            for rings in polygons:
                xs = [point[0] for point in rings[0]]
                ys = [point[1] for point in rings[0]]
                box = (min(xs), min(ys), max(xs), max(ys))
                self.parts.append((feature['properties']['slug'], rings, box))

    def at(self, x: float, y: float) -> str | None:
        for slug, rings, (west, south, east, north) in self.parts:
            inside_box = west <= x <= east and south <= y <= north
            if (
                inside_box
                and in_ring(x, y, rings[0])
                and not any(in_ring(x, y, hole) for hole in rings[1:])
            ):
                return slug
        return None


def split_by_district(osm: dict[str, Any], districts: Districts) -> list[Run]:
    """Дороги OSM, разрезанные по районам.

    Отрезок относится к району своей середины; подряд идущие отрезки одного района — одна линия,
    чтобы на плите района лежали только его улицы.
    """
    runs: list[Run] = []
    for element in osm['elements']:
        kind = kind_of(element.get('tags', {}))
        points = way_points(element)
        if not kind or len(points) < 2:
            continue
        run: list[Point] = [points[0]]
        current: str | None = None
        for a, b in pairwise(points):
            slug = districts.at((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
            if len(run) > 1 and slug != current:
                runs.append((kind, current, run))
                run = [a]
            current = slug
            run.append(b)
        if len(run) > 1:
            runs.append((kind, current, run))
    return runs


def merge_runs(runs: list[list[Point]]) -> list[list[Point]]:
    """Линии, склеенные там, где одна продолжает другую (в общем конце сходятся ровно две).

    Рисунок тот же, а объектов в файле в разы меньше — у большого города это десятки мегабайт.
    """
    ends: dict[Point, list[int]] = {}
    for i, run in enumerate(runs):
        for point in (run[0], run[-1]):
            ends.setdefault(point, []).append(i)
    used = [False] * len(runs)

    def follow(line: list[Point], current: int) -> list[Point]:
        while True:
            tail = line[-1]
            following = [j for j in ends.get(tail, []) if j != current]
            if len(ends.get(tail, [])) != 2 or len(following) != 1 or used[following[0]]:
                return line
            current = following[0]
            used[current] = True
            run = runs[current]
            line.extend(run[1:] if run[0] == tail else run[-2::-1])

    merged: list[list[Point]] = []
    for i, run in enumerate(runs):
        if used[i]:
            continue
        used[i] = True
        line = follow(list(run), i)
        line = follow(line[::-1], i)
        merged.append(line)
    return merged


def simplify(points: list[Point], tolerance_m: float, lat0: float) -> list[Point]:
    """Упрощение Дугласа — Пекера в метрах вокруг города. Остаются только вершины OSM."""
    if len(points) < 3:
        return points
    kx = math.cos(math.radians(lat0)) * SIMPLIFY_LON_M
    ky = SIMPLIFY_LAT_M
    meters = [(x * kx, y * ky) for x, y in points]
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        start, end = stack.pop()
        ax, ay = meters[start]
        bx, by = meters[end]
        dx, dy = bx - ax, by - ay
        length = math.hypot(dx, dy)
        best, index = 0.0, -1
        for i in range(start + 1, end):
            px, py = meters[i]
            # Замкнутая линия (кольцевая развязка, петля проезда): концы совпадают, прямой между
            # ними нет — расстояние считается до самой точки, иначе кольцо схлопнется и пропадёт.
            if length:
                distance = abs(dy * px - dx * py + bx * ay - by * ax) / length
            else:
                distance = math.hypot(px - ax, py - ay)
            if distance > best:
                best, index = distance, i
        if best > tolerance_m:
            keep[index] = True
            stack += [(start, index), (index, end)]
    return [point for point, kept in zip(points, keep, strict=True) if kept]


def street_features(
    runs: list[Run], lat0: float, skip_outside: set[str], tolerance: dict[str, float]
) -> list[dict[str, Any]]:
    """Линии схемы: склеенные, упрощённые, с координатами в 6 знаков."""
    groups: dict[tuple[str, str | None], list[list[Point]]] = {}
    for kind, slug, run in runs:
        if slug is None and kind in skip_outside:
            continue
        groups.setdefault((kind, slug), []).append(run)

    features: list[dict[str, Any]] = []
    for (kind, slug), lines in groups.items():
        for line in merge_runs(lines):
            coords = [
                [round(x, COORD_DIGITS), round(y, COORD_DIGITS)]
                for x, y in simplify(line, tolerance[kind], lat0)
            ]
            coords = [coords[0]] + [
                point for previous, point in pairwise(coords) if point != previous
            ]
            if len(coords) < 2:
                continue
            features.append(
                {
                    'type': 'Feature',
                    'properties': {'kind': kind, 'district': slug},
                    'geometry': {'type': 'LineString', 'coordinates': coords},
                }
            )
    return features


def write_streets(features: list[dict[str, Any]], folder: Path) -> int:
    """Записать схему дорог по файлу на район и вернуть общий размер в байтах.

    Дороги вне районов идут в _outside.geojson. Огромный город в одном файле тормозит в редакторе,
    а правка района меняет только свой файл.
    """
    groups: dict[str, list[dict[str, Any]]] = {}
    for feature in features:
        groups.setdefault(feature['properties']['district'] or OUTSIDE, []).append(feature)
    folder.mkdir(parents=True, exist_ok=True)
    for old in folder.glob('*.geojson'):
        old.unlink()
    return sum(
        write_json(folder / f'{name}.geojson', feature_collection(items))
        for name, items in sorted(groups.items())
    )


def parse_tolerance(text: str) -> dict[str, float]:
    """Допуски упрощения: свои значения вида local=1,service=1.5 поверх TOLERANCE_M."""
    tolerance = dict(TOLERANCE_M)
    for item in filter(None, text.split(',')):
        kind, value = item.split('=')
        tolerance[kind] = float(value)
    return tolerance


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('city', help='slug города, например kostanay')
    parser.add_argument('--osm', type=Path, help='сохранённый ответ Overpass (без запроса в сеть)')
    parser.add_argument('--save-osm', type=Path, help='сохранить ответ Overpass для --osm')
    parser.add_argument('--tiles', type=int, default=1, help='загрузка по частям: сетка N × N')
    parser.add_argument(
        '--skip-outside',
        default='',
        help='классы, которые вне районов не нужны, через запятую (у больших городов — service)',
    )
    parser.add_argument(
        '--tolerance',
        default='',
        help='свой допуск упрощения, м: local=1,service=1.5 (огромный город не выходит за 50 МБ)',
    )
    args = parser.parse_args()

    folder = DATA / args.city
    city = read_json(folder / 'city.json')
    districts = Districts(read_json(folder / 'districts.geojson'))
    if args.osm:
        osm = read_json(args.osm)
    else:
        osm = fetch(city['bbox'], args.tiles)
        if args.save_osm:
            args.save_osm.parent.mkdir(parents=True, exist_ok=True)
            args.save_osm.write_text(json.dumps(osm), encoding='utf-8')
    if not osm.get('elements'):
        raise SystemExit('В ответе OSM нет дорог — файлы улиц не тронуты')

    skip_outside = {kind for kind in args.skip_outside.split(',') if kind}
    runs = split_by_district(osm, districts)
    features = street_features(
        runs, city['center'][1], skip_outside, parse_tolerance(args.tolerance)
    )
    size = write_streets(features, folder / 'streets')

    kinds = Counter(feature['properties']['kind'] for feature in features)
    files = len(list((folder / 'streets').glob('*.geojson')))
    print(f'{len(features)} линий, {size // 1024} КБ в {files} файлах: {dict(kinds)}')
    print(f'Плитки карты: python tools/city-data/build_map_tiles.py {args.city}')


if __name__ == '__main__':
    main()
