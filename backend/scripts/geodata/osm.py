"""OpenStreetMap: запросы к Overpass API, кеш ответов и разбор путей и отношений.

Каждый ответ Overpass сохраняется в backend/.osm-cache/: повторная сборка идёт без сети и на тех же
данных. Чтобы взять свежий OSM, файл кеша удаляют — скрипт скачает его заново.
"""

import json
import math
import time
import urllib.parse
import urllib.request
from collections.abc import Callable
from pathlib import Path

from shapely.geometry import LineString, Polygon
from shapely.ops import linemerge, polygonize, polygonize_full, unary_union

from geodata.geometry import scale
from geodata.paths import CACHE

OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
USER_AGENT = 'VibeRay/0.1 (city mood map; data build script)'
RETRY_PAUSE_S = 30
STITCH_M = 200  # разрыв кольца отношения OSM не длиннее этого сшивается по ближайшим концам


def overpass(query: str, attempts: int = 8) -> dict:
    """Ответ Overpass API на запрос. Сервер часто занят (429, 504) — тогда ждём и повторяем."""
    body = urllib.parse.urlencode({'data': query}).encode()
    for attempt in range(attempts):
        request = urllib.request.Request(
            OVERPASS_URL, data=body, headers={'User-Agent': USER_AGENT}
        )
        try:
            with urllib.request.urlopen(request, timeout=360) as response:
                return json.load(response)
        except (OSError, ValueError) as error:
            print(f'Overpass: попытка {attempt + 1} не удалась ({error})')
            time.sleep(RETRY_PAUSE_S)
    raise SystemExit('Overpass недоступен — попробуйте позже или передайте сохранённый ответ')


def cached(path: Path, load: Callable[[], dict]) -> dict:
    """Ответ с диска, а если его нет — из сети (и сразу на диск)."""
    if path.exists():
        return json.loads(path.read_text(encoding='utf-8'))
    data = load()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data), encoding='utf-8')
    return data


def official_boundaries(slug: str, query: str) -> dict:
    """Отношения официальных районов города (запрос — CITIES[slug]['query'])."""
    return cached(
        CACHE / f'{slug}-boundaries.json',
        lambda: overpass(f'[out:json][timeout:300];{query}out geom;'),
    )


def find_relations(osm: dict, districts: dict[str, str]) -> dict[str, dict]:
    """Отношение OSM каждого района: slug → отношение с тегом name из настроек города."""
    found: dict[str, list[dict]] = {slug: [] for slug in districts}
    slug_of = {name: slug for slug, name in districts.items()}
    for element in osm['elements']:
        name = element.get('tags', {}).get('name')
        if element['type'] == 'relation' and name in slug_of:
            found[slug_of[name]].append(element)
    result = {}
    for slug, relations in found.items():
        if len(relations) != 1:
            problem = 'нет' if not relations else f'{len(relations)} отношения'
            raise SystemExit(f'«{districts[slug]}»: в ответе OSM {problem} — уточните query')
        result[slug] = relations[0]
    return result


def way_points(element: dict) -> list[tuple[float, float]]:
    """Вершины пути OSM (ответ с out geom): [(долгота, широта)]."""
    return [(node['lon'], node['lat']) for node in element.get('geometry') or []]


def way_line(element: dict) -> LineString | None:
    points = way_points(element)
    return LineString(points) if len(points) > 1 else None


def relation_area(relation: dict, lat0: float):
    """Территория отношения OSM (мультиполигона или границы): внешние кольца минус внутренние."""
    name = relation['tags'].get('name', str(relation['id']))
    outer: list[LineString] = []
    inner: list[LineString] = []
    for member in relation['members']:
        line = way_line(member) if member['type'] == 'way' else None
        if line is not None:
            (inner if member.get('role') == 'inner' else outer).append(line)
    area = unary_union(closed_rings(outer, lat0, name))
    if not inner:
        return area
    return area.difference(unary_union(closed_rings(inner, lat0, name)))


def closed_rings(lines: list[LineString], lat0: float, name: str) -> list[Polygon]:
    """Полигоны из путей отношения. Концы путей в OSM иногда не сходятся — короткий разрыв
    сшивается прямой между ближайшими концами, длинный считается ошибкой данных."""
    polygons, dangles, cuts, _ = polygonize_full(unary_union(lines))
    loose = [*dangles.geoms, *cuts.geoms]
    if not loose:
        return list(polygons.geoms)
    kx, ky = scale(lat0)

    def gap_m(a: tuple, b: tuple) -> float:
        return math.hypot((b[0] - a[0]) * kx, (b[1] - a[1]) * ky)

    merged = linemerge(unary_union(loose))
    chains = [merged] if isinstance(merged, LineString) else list(merged.geoms)
    ends = [point for chain in chains for point in (chain.coords[0], chain.coords[-1])]
    bridges = []
    while ends:
        a = ends.pop()
        b = min(ends, key=lambda point: gap_m(a, point))
        gap = gap_m(a, b)
        if gap > STITCH_M:
            raise SystemExit(f'{name}: граница в OSM разорвана на {gap:.0f} м — не сшить')
        ends.remove(b)
        if gap:
            bridges.append(LineString([a, b]))
            print(f'{name}: разрыв границы {gap:.1f} м сшит')
    return list(polygonize(unary_union([*lines, *bridges])))
