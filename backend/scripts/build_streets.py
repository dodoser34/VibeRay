"""Схема дорог города из OpenStreetMap -> streets/<район>.geojson.

Берёт дороги (от магистралей до дворовых проездов) и железную дорогу через Overpass API, делит их на
классы схемы, разрезает по районам (участок относится к району своей середины) и слегка упрощает.
Названий и адресов в результате нет — только рисунок дорог. Лицензия данных — ODbL.

Пишет backend/data/cities/<slug>/streets/: по файлу на район (<slug района>.geojson)
и _outside.geojson для дорог вне районов; старые файлы папки удаляются. Фронтенд схему не читает:
карта и история рисуют дороги плитками, после этого скрипта их пересобирает build_map_tiles.py.

Запуск из корня репозитория:

    python backend/scripts/build_streets.py kostanay
    python backend/scripts/build_streets.py kostanay --osm saved_overpass.json  # без сети
    python backend/scripts/build_streets.py cologne --tiles 4 --skip-outside service  # крупный
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
PRINT_WIDTH = 100  # как printWidth в frontend/.prettierrc
OUTSIDE = '_outside'  # файл дорог вне районов (district = null)

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
    'pedestrian': 'local',
    'road': 'local',
    'service': 'service',
}
# Ряды парковок — не дороги; дворовые проезды, переулки и подъезды (driveway, alley) остаются.
SKIP_SERVICE = {'parking_aisle'}
# Допуск упрощения невелик: дороги лежат на общем слое под районами и должны совпадать с OSM.
TOLERANCE_M = {
    'major': 1.0,
    'secondary': 1.0,
    'tertiary': 0.8,
    'local': 0.6,
    'service': 0.5,
    'rail': 1.0,
}
COORD_DIGITS = 6  # ~0,1 м

Point = tuple[float, float]
Ring = list[list[float]]


def overpass(query: str, attempts: int = 8) -> dict:
    """Запрос к Overpass API с повторами (общий для всех скриптов геоданных)."""
    body = urllib.parse.urlencode({'data': query}).encode()
    for attempt in range(attempts):
        request = urllib.request.Request(OVERPASS, data=body, headers={'User-Agent': USER_AGENT})
        try:
            with urllib.request.urlopen(request, timeout=360) as response:
                return json.load(response)
        except (OSError, ValueError) as error:  # Overpass часто занят: 429/504 — ждём и повторяем
            print(f'Overpass: попытка {attempt + 1} не удалась ({error})')
            time.sleep(30)
    raise SystemExit('Overpass недоступен — попробуйте позже или передайте сохранённый ответ')


def fetch_box(south: float, west: float, north: float, east: float) -> dict:
    box = f'{south},{west},{north},{east}'
    highways = '|'.join(KIND)
    return overpass(
        '[out:json][timeout:300];('
        f'way["highway"~"^({highways})$"]({box});'
        f'way["railway"="rail"]({box});'
        ');out tags geom;'
    )


def fetch(bbox: list[float], tiles: int = 1) -> dict:
    """Большой город с дворовыми проездами Overpass одним запросом не отдаёт — охват режется на
    tiles × tiles частей; путь, попавший в несколько частей, берётся один раз."""
    west, south, east, north = (
        bbox[0] - MARGIN_DEG,
        bbox[1] - MARGIN_DEG,
        bbox[2] + MARGIN_DEG,
        bbox[3] + MARGIN_DEG,
    )
    step_x, step_y = (east - west) / tiles, (north - south) / tiles
    elements: dict[int, dict] = {}
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
        length = math.hypot(dx, dy)
        best, index = 0.0, -1
        for i in range(start + 1, end):
            px, py = m[i]
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


def merge_runs(runs: list[list[Point]]) -> list[list[Point]]:
    """Склейка линий, которые продолжают друг друга (общий конец, где сходятся ровно две линии):
    рисунок тот же, а объектов в файле в разы меньше — у большого города это десятки мегабайт."""
    ends: dict[Point, list[int]] = {}
    for i, run in enumerate(runs):
        for point in (run[0], run[-1]):
            ends.setdefault(point, []).append(i)
    used = [False] * len(runs)

    def follow(line: list[Point], current: int) -> list[Point]:
        while True:
            tail = line[-1]
            nxt = [j for j in ends.get(tail, []) if j != current]
            if len(ends.get(tail, [])) != 2 or len(nxt) != 1 or used[nxt[0]]:
                return line
            current = nxt[0]
            used[current] = True
            run = runs[current]
            line.extend(run[1:] if run[0] == tail else run[-2::-1])

    merged = []
    for i, run in enumerate(runs):
        if used[i]:
            continue
        used[i] = True
        line = follow(list(run), i)
        line = follow(line[::-1], i)
        merged.append(line)
    return merged


def kind_of(tags: dict) -> str | None:
    if tags.get('railway') == 'rail':
        return 'rail'
    if tags.get('service') in SKIP_SERVICE or tags.get('area') == 'yes':
        return None
    return KIND.get(tags.get('highway', ''))


def build(
    osm: dict,
    districts: Districts,
    lat0: float,
    skip_outside: set[str],
    tolerance: dict[str, float],
) -> dict:
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

    groups: dict[tuple[str, str | None], list[list[Point]]] = {}
    for kind, slug, run in features:
        if slug is None and kind in skip_outside:
            continue
        groups.setdefault((kind, slug), []).append(run)

    result = {'type': 'FeatureCollection', 'features': []}
    for (kind, slug), runs in groups.items():
        for run in merge_runs(runs):
            line = simplify(run, tolerance[kind], lat0)
            coords = [[round(x, COORD_DIGITS), round(y, COORD_DIGITS)] for x, y in line]
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


def pretty(value: object, indent: int = 0, prefix: int = 0) -> str:
    """JSON в том же виде, что даёт Prettier фронтенда (отступ 2, ширина 100): построчные дифы в git."""
    pad = '  ' * indent
    if isinstance(value, dict):
        if not value:
            return '{}'
        keys = [json.dumps(key, ensure_ascii=False) for key in value]
        parts = [
            f'{key}: {pretty(item, indent + 1, len(key) + 2)}'
            for key, item in zip(keys, value.values(), strict=True)
        ]
        inline = '{ ' + ', '.join(parts) + ' }'
        if '\n' not in inline and len(pad) + prefix + len(inline) + 1 <= PRINT_WIDTH:
            return inline
        return '{\n' + ',\n'.join(f'{pad}  {part}' for part in parts) + f'\n{pad}}}'
    if isinstance(value, list):
        if not value:
            return '[]'
        # Prettier всегда переносит список из нескольких списков/объектов (например, точек линии)
        nested = len(value) > 1 and len({type(item) for item in value}) == 1
        nested = nested and all(isinstance(item, list | dict) and len(item) > 1 for item in value)
        parts = [pretty(item, indent + 1) for item in value]
        inline = '[' + ', '.join(parts) + ']'
        fits = '\n' not in inline and len(pad) + prefix + len(inline) + 1 <= PRINT_WIDTH
        if fits and not nested:
            return inline
        return '[\n' + ',\n'.join(f'{pad}  {part}' for part in parts) + f'\n{pad}]'
    return json.dumps(value, ensure_ascii=False)


def write_streets(streets: dict, folder: Path) -> int:
    """Пишет схему дорог по файлу на район (вне районов — _outside.geojson): огромный город
    в одном файле тормозит в редакторе, а правка района меняет только свой файл.
    Возвращает размер в байтах."""
    groups: dict[str, list[dict]] = {}
    for feature in streets['features']:
        name = feature['properties']['district'] or OUTSIDE
        groups.setdefault(name, []).append(feature)
    folder.mkdir(parents=True, exist_ok=True)
    for old in folder.glob('*.geojson'):
        old.unlink()
    size = 0
    for name, features in sorted(groups.items()):
        text = pretty({'type': 'FeatureCollection', 'features': features}) + '\n'
        (folder / f'{name}.geojson').write_text(text, encoding='utf-8', newline='\n')
        size += len(text.encode('utf-8'))
    return size


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

    backend_dir = ROOT / 'backend' / 'data' / 'cities' / args.city
    city = json.loads((backend_dir / 'city.json').read_text(encoding='utf-8'))
    districts = Districts(json.loads((backend_dir / 'districts.geojson').read_text('utf-8')))
    if args.osm:
        osm = json.loads(args.osm.read_text(encoding='utf-8'))
    else:
        osm = fetch(city['bbox'], args.tiles)
        if args.save_osm:
            args.save_osm.write_text(json.dumps(osm), encoding='utf-8')
    if not osm.get('elements'):
        raise SystemExit('В ответе OSM нет дорог — файлы улиц не тронуты')

    skip_outside = {kind for kind in args.skip_outside.split(',') if kind}
    tolerance = dict(TOLERANCE_M)
    for item in filter(None, args.tolerance.split(',')):
        kind, value = item.split('=')
        tolerance[kind] = float(value)
    streets = build(
        osm,
        districts,
        lat0=city['center'][1],
        skip_outside=skip_outside,
        tolerance=tolerance,
    )
    folder = backend_dir / 'streets'
    size = write_streets(streets, folder)

    kinds = Counter(f['properties']['kind'] for f in streets['features'])
    files = len(list(folder.glob('*.geojson')))
    print(f'{len(streets["features"])} линий, {size // 1024} КБ в {files} файлах: {dict(kinds)}')
    print(f'Плитки карты: python backend/scripts/build_map_tiles.py {args.city}')


if __name__ == '__main__':
    main()
