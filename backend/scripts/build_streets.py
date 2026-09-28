"""Схема дорог города из OpenStreetMap -> streets.geojson.

Берёт дороги (от магистралей до дворовых проездов) и железную дорогу через Overpass API, делит их на
классы схемы, разрезает по районам (участок относится к району своей середины) и слегка упрощает.
Названий и адресов в результате нет — только рисунок дорог. Лицензия данных — ODbL.

Запуск из корня репозитория (пишет в обе копии данных — для бэкенда и для демо фронтенда):

    python backend/scripts/build_streets.py kostanay
    python backend/scripts/build_streets.py kostanay --osm saved_overpass.json  # без сети
"""

import argparse
import json
import math
import time
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OVERPASS = 'https://overpass-api.de/api/interpreter'
USER_AGENT = 'VibeRay/0.1 (city mood map; data build script)'
MARGIN_DEG = 0.02  # запас вокруг города, чтобы подложка не обрывалась у края районов

KIND = {
    'motorway': 'major',
    'motorway_link': 'major',
    'trunk': 'major',
    'trunk_link': 'major',
    'primary': 'major',
    'primary_link': 'major',
    'secondary': 'secondary',
    'secondary_link': 'secondary',
    'tertiary': 'tertiary',
    'tertiary_link': 'tertiary',
    'unclassified': 'local',
    'residential': 'local',
    'living_street': 'local',
    'road': 'local',
    'service': 'service',
}
SKIP_SERVICE = {'parking_aisle', 'drive-through'}
TOLERANCE_M = {
    'major': 3.0,
    'secondary': 3.0,
    'tertiary': 2.5,
    'local': 2.0,
    'service': 1.5,
    'rail': 3.0,
}

Point = tuple[float, float]
Ring = list[list[float]]


def fetch(bbox: list[float], attempts: int = 6) -> dict:
    west, south, east, north = bbox
    box = (
        f'{south - MARGIN_DEG},{west - MARGIN_DEG},{north + MARGIN_DEG},{east + MARGIN_DEG}'
    )
    highways = '|'.join(KIND)
    query = (
        '[out:json][timeout:180];('
        f'way["highway"~"^({highways})$"]({box});'
        f'way["railway"="rail"]({box});'
        ');out tags geom;'
    )
    body = urllib.parse.urlencode({'data': query}).encode()
    for attempt in range(attempts):
        request = urllib.request.Request(OVERPASS, data=body, headers={'User-Agent': USER_AGENT})
        try:
            with urllib.request.urlopen(request, timeout=240) as response:
                return json.load(response)
        except OSError as error:  # Overpass часто занят: 429/504 — ждём и повторяем
            print(f'Overpass: попытка {attempt + 1} не удалась ({error})')
            time.sleep(25)
    raise SystemExit('Overpass недоступен — попробуйте позже или передайте --osm')


def in_ring(x: float, y: float, ring: Ring) -> bool:
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
    def __init__(self, geojson: dict) -> None:
        self.parts: list[tuple[str, list[Ring], tuple[float, float, float, float]]] = []
        for feature in geojson['features']:
            geometry = feature['geometry']
            polygons = (
                geometry['coordinates']
                if geometry['type'] == 'MultiPolygon'
                else [geometry['coordinates']]
            )
            for rings in polygons:
                xs = [c[0] for c in rings[0]]
                ys = [c[1] for c in rings[0]]
                box = (min(xs), min(ys), max(xs), max(ys))
                self.parts.append((feature['properties']['slug'], rings, box))

    def at(self, x: float, y: float) -> str | None:
        for slug, rings, (a, b, c, d) in self.parts:
            if a <= x <= c and b <= y <= d and in_ring(x, y, rings[0]):
                if not any(in_ring(x, y, hole) for hole in rings[1:]):
                    return slug
        return None


def simplify(points: list[Point], tolerance_m: float, lat0: float) -> list[Point]:
    """Дуглас–Пекер в метрах локальной проекции."""
    if len(points) < 3:
        return points
    kx = math.cos(math.radians(lat0)) * 111_320
    ky = 110_540
    m = [(x * kx, y * ky) for x, y in points]
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        start, end = stack.pop()
        ax, ay = m[start]
        bx, by = m[end]
        dx, dy = bx - ax, by - ay
        length = math.hypot(dx, dy) or 1e-9
        best, index = 0.0, -1
        for i in range(start + 1, end):
            px, py = m[i]
            distance = abs(dy * px - dx * py + bx * ay - by * ax) / length
            if distance > best:
                best, index = distance, i
        if best > tolerance_m:
            keep[index] = True
            stack += [(start, index), (index, end)]
    return [point for point, kept in zip(points, keep, strict=True) if kept]


def kind_of(tags: dict) -> str | None:
    if tags.get('railway') == 'rail':
        return 'rail'
    if tags.get('service') in SKIP_SERVICE or tags.get('area') == 'yes':
        return None
    return KIND.get(tags.get('highway', ''))


def build(osm: dict, districts: Districts, lat0: float) -> dict:
    features = []
    for element in osm['elements']:
        kind = kind_of(element.get('tags', {}))
        points = [(node['lon'], node['lat']) for node in element.get('geometry', [])]
        if not kind or len(points) < 2:
            continue
        # Отрезок — району своей середины; подряд идущие отрезки одного района — одна линия, чтобы
        # на плите района лежали только его улицы и ничего не свисало за край.
        run: list[Point] = [points[0]]
        current: str | None = None
        for a, b in zip(points, points[1:], strict=False):
            slug = districts.at((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
            if len(run) > 1 and slug != current:
                features.append((kind, current, run))
                run = [a]
            current = slug
            run.append(b)
        if len(run) > 1:
            features.append((kind, current, run))

    result = {'type': 'FeatureCollection', 'features': []}
    for kind, slug, run in features:
        line = simplify(run, TOLERANCE_M[kind], lat0)
        coords = [[round(x, 5), round(y, 5)] for x, y in line]
        coords = [coords[0]] + [c for p, c in zip(coords, coords[1:], strict=False) if c != p]
        if len(coords) < 2:
            continue
        result['features'].append(
            {
                'type': 'Feature',
                'properties': {'kind': kind, 'district': slug},
                'geometry': {'type': 'LineString', 'coordinates': coords},
            }
        )
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('city', help='slug города, например kostanay')
    parser.add_argument('--osm', type=Path, help='сохранённый ответ Overpass (без запроса в сеть)')
    args = parser.parse_args()

    backend_dir = ROOT / 'backend' / 'data' / 'cities' / args.city
    frontend_dir = ROOT / 'frontend' / 'src' / 'data' / 'cities' / args.city
    city = json.loads((backend_dir / 'city.json').read_text(encoding='utf-8'))
    districts = Districts(json.loads((backend_dir / 'districts.geojson').read_text('utf-8')))
    osm = (
        json.loads(args.osm.read_text(encoding='utf-8')) if args.osm else fetch(city['bbox'])
    )

    streets = build(osm, districts, lat0=city['center'][1])
    text = json.dumps(streets, ensure_ascii=False, separators=(',', ':'))
    for directory in (backend_dir, frontend_dir):
        (directory / 'streets.geojson').write_text(text, encoding='utf-8')

    kinds = Counter(f['properties']['kind'] for f in streets['features'])
    print(f'{len(streets["features"])} линий, {len(text) // 1024} КБ: {dict(kinds)}')


if __name__ == '__main__':
    main()
