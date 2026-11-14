"""Плитки подложки карты: дороги и вода города -> frontend/public/maps/<slug>/.

Карта города рисует дороги и воду не линиями из streets/*.geojson, а готовыми картинками (WebP без
потерь), лежащими плоско под районами. Плитки — пирамида уровней, как у веб-карт: самый детальный
уровень 3 м на пиксель, каждый следующий вдвое грубее, пока весь город не уложится в 2 × 2 плитки;
карта берёт уровень по расстоянию до камеры. Плитка — не цвета, а маска покрытия по каналам (цвета
накладывает шейдер из токенов темы, поэтому одна картинка подходит обеим темам):

    R — вода, G — местные дороги и проезды, B — магистрали и железная дорога (пунктиром).

Прозрачность классов «вшита» в значение канала. Альфа-канала нет: браузеры могут портить цвет
прозрачных пикселей при загрузке. Проекция — та же, что на фронтенде (geoProjection.js): км вокруг
центра города, +y — на север. Плитки за контуром города (cityOutline.js) не рисуются.

Вблизи (уровень улицы) картинки мало: для каждой клетки самого детального уровня рядом лежит
векторный кусок vector/<x>_<y>.json — линии дорог этой клетки (обрезанные по её краю), карта рисует
их чёткими при любом приближении. Координаты куска — целые дециметры от юго-западного угла клетки.

Запуск из корня репозитория (нужна Pillow — она есть в backend/requirements.txt):

    python backend/scripts/build_map_tiles.py kostanay
    python backend/scripts/build_map_tiles.py --all
"""

import argparse
import hashlib
import json
import math
import shutil
from pathlib import Path

from PIL import Image, ImageDraw

from geodata.geometry import scale
from geodata.output import read_json
from geodata.paths import DATA, MAPS

TILE_PX = 512  # мелкая плитка — в видеопамяти только видимое, без больших запасов по краям
SUPERSAMPLE = 2  # плитка рисуется вдвое крупнее и уменьшается — края линий сглажены
FINEST_MPP = 3.0  # метров на пиксель на самом детальном уровне
MIN_LINE_PX = 0.8  # тоньше линия не бывает: на обзорных уровнях сеть остаётся читаемой
ROOT_TILES = 2  # самый грубый уровень — город в 2 × 2 плитки
MAX_LEVELS = 14

# Контур города — как в cityOutline.js: касательные к районам, отодвинутые на запас.
OUTLINE_SIDES = 72
MARGIN_SHARE = 0.06
MIN_MARGIN_KM = 0.6

# Класс дороги -> (канал, значение покрытия, ширина на земле в метрах). Порядок — порядок рисования:
# внутри канала следующий класс ложится поверх предыдущего.
ROADS = [
    ('service', 'G', 0.6, 3.0),
    ('local', 'G', 0.95, 5.0),
    ('rail', 'B', 0.85, 5.0),
    ('tertiary', 'B', 0.75, 9.0),
    ('secondary', 'B', 0.9, 11.0),
    ('major', 'B', 1.0, 14.0),
]
DASH_M = 50.0  # пунктир железной дороги (такой же у векторных кусков)
GAP_M = 35.0
VECTOR_UNIT_M = 0.1  # шаг координат векторного куска
EDGE_PAD_KM = 0.03  # толстые линии у края плитки продолжаются в соседней без шва
BUCKET_PAD_KM = 0.05

Point = tuple[float, float]
Box = tuple[float, float, float, float]


def projection(center: list[float]):
    """Градусы -> км от центра города (+x — восток, +y — север), как geoProjection.js."""
    lon0, lat0 = center
    kx, ky = scale(lat0)
    kx, ky = kx / 1000, ky / 1000
    return lambda lon, lat: ((lon - lon0) * kx, (lat - lat0) * ky)


def outline(points: list[Point]) -> list[tuple[float, float, float]]:
    """Выпуклый контур города с запасом: стороны (нормаль x, нормаль y, расстояние от центра)."""
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    span = max(max(xs) - min(xs), max(ys) - min(ys))
    margin = max(MIN_MARGIN_KM, span * MARGIN_SHARE)
    edges = []
    for k in range(OUTLINE_SIDES):
        angle = 2 * math.pi * k / OUTLINE_SIDES
        nx, ny = math.cos(angle), math.sin(angle)
        reach = max(nx * x + ny * y for x, y in points)
        edges.append((nx, ny, reach + margin))
    return edges


def box_inside(box: Box, edges) -> bool:
    """Задевает ли прямоугольник выпуклый контур (ни одна сторона не отсекает все его углы)."""
    x0, y0, x1, y1 = box
    corners = ((x0, y0), (x1, y0), (x0, y1), (x1, y1))
    return not any(all(nx * x + ny * y > h for x, y in corners) for nx, ny, h in edges)


def bbox(points: list[Point]) -> Box:
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return min(xs), min(ys), max(xs), max(ys)


def dashes(line: list[Point]) -> list[list[Point]]:
    """Полилиния (км) -> куски пунктира."""
    out: list[list[Point]] = []
    inside, left = True, DASH_M / 1000  # штрих или пробел и сколько км от него осталось
    current: list[Point] = [line[0]]
    for (ax, ay), (bx, by) in zip(line, line[1:], strict=False):
        length = math.hypot(bx - ax, by - ay)
        t = 0.0
        while length - t > left:
            t += left
            point = (ax + (bx - ax) * t / length, ay + (by - ay) * t / length)
            if inside:
                current.append(point)
                out.append(current)
            else:
                current = [point]
            inside = not inside
            left = (DASH_M if inside else GAP_M) / 1000
        left -= length - t
        if inside:
            current.append((bx, by))
    if inside and len(current) > 1:
        out.append(current)
    return out


def clip_line(line: list[Point], box: Box) -> list[list[Point]]:
    """Полилиния, обрезанная прямоугольником (Лианг — Барски по каждому отрезку): куски внутри."""
    x0, y0, x1, y1 = box
    pieces: list[list[Point]] = []
    piece: list[Point] = []
    for (ax, ay), (bx, by) in zip(line, line[1:], strict=False):
        dx, dy = bx - ax, by - ay
        t0, t1 = 0.0, 1.0
        for p, q in ((-dx, ax - x0), (dx, x1 - ax), (-dy, ay - y0), (dy, y1 - ay)):
            if p == 0:
                if q < 0:
                    t0, t1 = 1.0, 0.0
                continue
            t = q / p
            if p < 0:
                t0 = max(t0, t)
            else:
                t1 = min(t1, t)
        if t0 > t1:
            if len(piece) > 1:
                pieces.append(piece)
            piece = []
            continue
        start = (ax + dx * t0, ay + dy * t0)
        if not piece or t0 > 0:
            if len(piece) > 1:
                pieces.append(piece)
            piece = [start]
        piece.append((ax + dx * t1, ay + dy * t1))
        if t1 < 1:
            pieces.append(piece)
            piece = []
    if len(piece) > 1:
        pieces.append(piece)
    return pieces


class CityLayers:
    """Всё, что рисуется на плитках города, в км от его центра."""

    def __init__(self, slug: str) -> None:
        folder = DATA / slug
        self.center = read_json(folder / 'city.json')['center']
        project = projection(self.center)
        districts = read_json(folder / 'districts.geojson')
        self.edges = outline(
            [
                project(lon, lat)
                for f in districts['features']
                for polygon in f['geometry']['coordinates']
                for lon, lat in polygon[0]
            ]
        )
        self.lines: dict[str, list[list[Point]]] = {kind: [] for kind, *_ in ROADS}
        for path in sorted((folder / 'streets').glob('*.geojson')):
            for feature in read_json(path)['features']:
                kind = feature['properties']['kind']
                if kind in self.lines:
                    line = [project(lon, lat) for lon, lat in feature['geometry']['coordinates']]
                    self.lines[kind].extend(dashes(line) if kind == 'rail' else [line])
        self.water = [
            [[project(lon, lat) for lon, lat in ring] for ring in f['geometry']['coordinates']]
            for f in read_json(folder / 'water.geojson')['features']
            if f['geometry']['type'] == 'Polygon'
        ]


class Buckets:
    """Объекты, разложенные по клеткам сетки самого детального уровня: плитка любого уровня берёт
    только свои клетки, а не перебирает весь город."""

    def __init__(self, items: list[list], cell_km: float, pad_km: float) -> None:
        self.cell = cell_km
        self.items = items
        self.boxes = [bbox(item[0] if isinstance(item[0], list) else item) for item in items]
        self.grid: dict[tuple[int, int], list[int]] = {}
        for i, (x0, y0, x1, y1) in enumerate(self.boxes):
            for gx in self.cells(x0 - pad_km, x1 + pad_km):
                for gy in self.cells(y0 - pad_km, y1 + pad_km):
                    self.grid.setdefault((gx, gy), []).append(i)

    def cells(self, start: float, end: float) -> range:
        return range(math.floor(start / self.cell), math.floor(end / self.cell) + 1)

    def query(self, x0: float, y0: float, x1: float, y1: float) -> list:
        found: set[int] = set()
        for gx in range(math.floor(x0 / self.cell), math.ceil(x1 / self.cell)):
            for gy in range(math.floor(y0 / self.cell), math.ceil(y1 / self.cell)):
                found.update(self.grid.get((gx, gy), ()))
        return [self.items[i] for i in sorted(found)]


def render_tile(x: int, y: int, tile_km: float, mpp: float, roads, water) -> Image.Image | None:
    """Плитка (x, y) уровня mpp метров на пиксель или None, если на ней ничего нет."""
    size = TILE_PX * SUPERSAMPLE
    px_per_km = SUPERSAMPLE * 1000 / mpp
    x0, y0, x1, y1 = x * tile_km, y * tile_km, (x + 1) * tile_km, (y + 1) * tile_km
    area = (x0 - EDGE_PAD_KM, y0 - EDGE_PAD_KM, x1 + EDGE_PAD_KM, y1 + EDGE_PAD_KM)

    def to_px(p: Point) -> tuple[float, float]:
        return ((p[0] - x0) * px_per_km, (y1 - p[1]) * px_per_km)  # строка 0 — северный край

    channels = {name: Image.new('L', (size, size), 0) for name in 'RGB'}
    drawn = False

    river = ImageDraw.Draw(channels['R'])
    for rings in water.query(*area):
        river.polygon([to_px(p) for p in rings[0]], fill=255)
        for island in rings[1:]:
            river.polygon([to_px(p) for p in island], fill=0)
        drawn = True

    for kind, channel, value, width_m in ROADS:
        draw = ImageDraw.Draw(channels[channel])
        width = max(width_m / mpp, MIN_LINE_PX) * SUPERSAMPLE
        line_px = max(1, round(width))
        fill = round(255 * value * min(1.0, width / line_px))
        for line in roads[kind].query(*area):
            draw.line([to_px(p) for p in line], fill=fill, width=line_px, joint='curve')
            drawn = True

    if not drawn:
        return None
    image = Image.merge('RGB', [channels[name] for name in 'RGB']).reduce(SUPERSAMPLE)
    return image if image.getbbox() else None


def render_levels(slug: str, edges: list, roads: dict, water: Buckets, target: Path) -> list[dict]:
    """Уровни пирамиды от самого детального, пока город не уложится в ROOT_TILES × ROOT_TILES."""
    ox0, oy0, ox1, oy1 = bbox([(h * nx, h * ny) for nx, ny, h in edges])
    span = max(ox1 - ox0, oy1 - oy0)
    levels = []
    for z in range(MAX_LEVELS):
        mpp = FINEST_MPP * 2**z
        tile_km = TILE_PX * mpp / 1000
        tiles = []
        for x in range(math.floor(ox0 / tile_km), math.floor(ox1 / tile_km) + 1):
            for y in range(math.floor(oy0 / tile_km), math.floor(oy1 / tile_km) + 1):
                box = (x * tile_km, y * tile_km, (x + 1) * tile_km, (y + 1) * tile_km)
                if not box_inside(box, edges):
                    continue
                image = render_tile(x, y, tile_km, mpp, roads, water)
                if image is None:
                    continue
                path = target / str(z) / f'{x}_{y}.webp'
                path.parent.mkdir(parents=True, exist_ok=True)
                image.save(path, 'WEBP', lossless=True, quality=80, method=4)
                tiles.append([x, y])
        levels.append({'metersPerPixel': mpp, 'tileKm': tile_km, 'tiles': tiles})
        print(f'{slug}: уровень {z} — {mpp:g} м/px, {len(tiles)} плиток', flush=True)
        if span <= tile_km * (ROOT_TILES - 1):
            break
    return levels


def vector_chunk(x: int, y: int, cell_km: float, roads: dict) -> dict | None:
    """Линии дорог клетки по классам: [x0, y0, x1, y1, …] в дециметрах от угла клетки."""
    box = (x * cell_km, y * cell_km, (x + 1) * cell_km, (y + 1) * cell_km)
    unit = VECTOR_UNIT_M / 1000
    chunk = {}
    for kind, *_ in ROADS:
        out = []
        for line in roads[kind].query(*box):
            for piece in clip_line(line, box):
                flat = []
                for px, py in piece:
                    flat += [round((px - box[0]) / unit), round((py - box[1]) / unit)]
                if len(flat) >= 4:
                    out.append(flat)
        if out:
            chunk[kind] = out
    return chunk or None


def write_vectors(tiles: list[list[int]], cell_km: float, roads: dict, target: Path) -> list:
    """Векторные куски — по клеткам самого детального уровня, где есть его плитки."""
    vector = []
    for x, y in tiles:
        chunk = vector_chunk(x, y, cell_km, roads)
        if chunk is None:
            continue
        path = target / 'vector' / f'{x}_{y}.json'
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(chunk, separators=(',', ':')), encoding='utf-8')
        vector.append([x, y])
    return vector


def content_version(target: Path) -> str:
    """Хеш всех файлов: по нему сервис-воркер сайта сбрасывает кэш после пересборки."""
    digest = hashlib.sha1()
    for path in sorted(target.rglob('*.*')):
        digest.update(path.relative_to(target).as_posix().encode())
        digest.update(path.read_bytes())
    return digest.hexdigest()[:12]


def build(slug: str) -> None:
    layers = CityLayers(slug)
    finest_km = TILE_PX * FINEST_MPP / 1000
    roads = {kind: Buckets(items, finest_km, BUCKET_PAD_KM) for kind, items in layers.lines.items()}
    water = Buckets(layers.water, finest_km, BUCKET_PAD_KM)

    target = MAPS / slug
    if target.exists():
        shutil.rmtree(target)
    levels = render_levels(slug, layers.edges, roads, water, target)
    vector = write_vectors(levels[0]['tiles'], finest_km, roads, target)
    manifest = {
        'version': content_version(target),
        'format': 'webp',
        'center': layers.center,
        'tilePx': TILE_PX,
        'levels': levels,
        'vectorCellKm': finest_km,
        'vectorUnitM': VECTOR_UNIT_M,
        'vector': vector,
    }
    (target / 'tiles.json').write_text(
        json.dumps(manifest, separators=(',', ':')), encoding='utf-8'
    )

    images = sum(p.stat().st_size for p in target.rglob('*.webp')) / 2**20
    chunks = sum(p.stat().st_size for p in target.rglob('vector/*.json')) / 2**20
    count = sum(len(level['tiles']) for level in levels)
    print(f'{slug}: {count} плиток {images:.1f} МБ, {len(vector)} векторных кусков {chunks:.1f} МБ')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('city', nargs='?', help='slug города, например kostanay')
    parser.add_argument('--all', action='store_true', help='все города из backend/data/cities')
    args = parser.parse_args()
    if not args.all and not args.city:
        parser.error('укажите город или --all')
    slugs = sorted(p.name for p in DATA.iterdir() if p.is_dir()) if args.all else [args.city]
    for slug in slugs:
        build(slug)


if __name__ == '__main__':
    main()
