"""Вода города из OpenStreetMap -> water.geojson.

Реки, озёра, водохранилища, гавани и море — площадями. Как устроена вода и зачем каждое правило,
описано в ARCHITECTURE.md (разделы 5.1 и 5.2, «Вода»):

- площади воды — замкнутые пути и мультиполигоны OSM (natural=water, waterway=riverbank|dock,
  landuse=reservoir|basin), острова остаются дырами;
- море — по береговой линии OSM (natural=coastline): суша слева от линии, вода справа;
- где у реки в OSM есть только осевая линия, русло рисуется лентой RIVER_RIBBON_M в обе стороны
  (как она стыкуется с площадью русла — river_ribbons);
- водоёмы меньше MIN_AREA_M2 отбрасываются, контуры упрощаются на SIMPLIFY_M;
- водоёмы больше SPLIT_AREA_M2 режутся сеткой SPLIT_CELL_M: огромный полигон моря с островами
  браузер триангулирует с ошибками.

Воду берём шире районов (MARGIN_DEG), чтобы река и залив не обрывались у края кадра. Рамку города
скрипт берёт из city.json (bbox), а для нового города — из официальных границ районов в OSM; в этом
случае он же записывает в city.json приблизительные center и bbox (их потом уточнит
build_districts.py). Ответ Overpass кешируется в tools/city-data/.osm-cache/<slug>-water-areas.json.

Пишет backend/data/cities/<slug>/water.geojson и копию для демо-режима фронтенда. После него —
build_districts.py: районы вычитают воду, поэтому берег района и берег на карте совпадают.

Запуск из корня репозитория:

    python tools/city-data/build_water.py cologne
    python tools/city-data/build_water.py cologne --out preview.geojson   # не трогая данные города
"""

import argparse
import math
from collections import Counter
from pathlib import Path

import shapely
from shapely.geometry import Point, Polygon, box
from shapely.geometry.polygon import orient
from shapely.ops import linemerge, polygonize, unary_union

from cities import CITIES
from geodata.geometry import Projection, parts, scale
from geodata.osm import (
    cached,
    find_relations,
    official_boundaries,
    overpass,
    relation_area,
    way_line,
)
from geodata.output import (
    copy_to_demo,
    feature_collection,
    polygon_coordinates,
    read_json,
    write_json,
)
from geodata.paths import CACHE, DATA

MARGIN_DEG = 0.12  # запас вокруг города: вода видна до края кадра
MIN_AREA_M2 = 3_000  # водоём меньше 0,3 га на карте не нужен
SIMPLIFY_M = 2.5
RIVER_RIBBON_M = 32  # полуширина русла, если у реки в OSM есть только ось (лента 64 м)
SHORT_EXIT_M = 2 * RIVER_RIBBON_M
SPLIT_AREA_M2 = 2_000_000  # водоём больше 2 км² режется сеткой
SPLIT_CELL_M = 4_000
COORD_DIGITS = 5  # ~1 м: точнее упрощения не нужно

AREA_TAGS = {
    'natural': {'water'},
    'waterway': {'riverbank', 'dock'},
    'landuse': {'reservoir', 'basin'},
}


def water_query(frame: tuple[float, float, float, float]) -> str:
    west, south, east, north = frame
    area = f'{south},{west},{north},{east}'
    return (
        '[out:json][timeout:300];('
        f'way["natural"~"^(water|coastline)$"]({area});'
        f'way["waterway"~"^(riverbank|dock|river)$"]({area});'
        f'way["landuse"~"^(reservoir|basin)$"]({area});'
        f'relation["natural"="water"]({area});'
        f'relation["waterway"="riverbank"]({area});'
        f'relation["landuse"~"^(reservoir|basin)$"]({area});'
        ');out geom;'
    )


def is_water_area(tags: dict) -> bool:
    return any(tags.get(key) in values for key, values in AREA_TAGS.items())


def city_frame(slug: str, info: dict) -> tuple[float, float, float, float]:
    """Рамка города: bbox из city.json, а у нового города — охват официальных районов в OSM."""
    if 'bbox' in info:
        return tuple(info['bbox'])
    config = CITIES[slug]
    if 'districts' not in config:
        raise SystemExit(f'{slug}: в city.json нет bbox, а официальных районов в настройках нет')
    osm = official_boundaries(slug, config['query'])
    relations = list(find_relations(osm, config['districts']).values())
    lat0 = next(m['geometry'][0]['lat'] for m in relations[0]['members'] if m.get('geometry'))
    return unary_union([relation_area(relation, lat0) for relation in relations]).bounds


def lake_areas(osm: dict, lat0: float) -> list:
    """Площади воды: замкнутые пути и мультиполигоны (внешние кольца минус острова)."""
    areas = []
    for element in osm['elements']:
        tags = element.get('tags', {})
        if not is_water_area(tags):
            continue
        if element['type'] == 'relation':
            try:
                areas.append(relation_area(element, lat0))
            except SystemExit as problem:  # отношение в OSM разорвано — без него вода не страшна
                print(f'пропущено отношение {element["id"]}: {problem}')
        else:
            line = way_line(element)
            if line is not None and line.is_closed and len(line.coords) >= 4:
                areas.append(Polygon(line.coords))
    return [shapely.make_valid(area) for area in areas]


def sea_area(osm: dict, frame: Polygon, projection: Projection):
    """Море по береговой линии OSM: в рамке остаются грани справа от линии (так рисуется берег)."""
    coast = [
        way_line(e) for e in osm['elements'] if e.get('tags', {}).get('natural') == 'coastline'
    ]
    coast = [line for line in coast if line is not None]
    if not coast:
        return Polygon()
    shore = linemerge(unary_union(coast))
    shore_m = projection.to_meters(shore)
    faces = polygonize(unary_union([frame.boundary, shore.intersection(frame)]))
    water = []
    for face in faces:
        inside = projection.to_meters(face.representative_point())
        if is_right_of(shore_m, inside):
            water.append(face)
    return unary_union(water)


def is_right_of(line, point: Point) -> bool:
    """Точка справа от ближайшего участка линии (по её направлению)."""
    nearest = min(getattr(line, 'geoms', [line]), key=lambda part: part.distance(point))
    along = nearest.project(point)
    start = nearest.interpolate(max(along - 1, 0))
    end = nearest.interpolate(min(along + 1, nearest.length))
    cross = (end.x - start.x) * (point.y - start.y) - (end.y - start.y) * (point.x - start.x)
    return cross < 0


def river_ribbons(osm: dict, lakes, projection: Projection):
    """Русла рек, у которых в OSM есть только ось: лента вдоль оси там, где площади воды нет.

    - У площади русла лента обрезана ровно поперёк оси: скруглённый конец касался бы площади одной
      точкой, и река на карте была бы пережата в месте стыка.
    - Ось, ненадолго вышедшая из узкой площади русла (оба конца у площади, короче SHORT_EXIT_M), —
      не русло: иначе поперёк протоки встают «плашки» шириной в ленту.
    - Слияния рек скругляются: у ровных концов на стыке осталась бы зазубрина."""
    axes = [way_line(e) for e in osm['elements'] if e.get('tags', {}).get('waterway') == 'river']
    axes = [projection.to_meters(line) for line in axes if line is not None]
    if not axes:
        return Polygon()
    lakes_m = projection.to_meters(lakes)
    shapely.prepare(lakes_m)

    def at_lake(point: tuple) -> bool:
        return lakes_m.distance(Point(point)) < 0.01

    bare = linemerge(unary_union(axes).difference(lakes_m))
    chains = [
        chain
        for chain in getattr(bare, 'geoms', [bare])
        if chain.length >= SHORT_EXIT_M
        or not (at_lake(chain.coords[0]) and at_lake(chain.coords[-1]))
    ]
    ends = Counter(point for chain in chains for point in (chain.coords[0], chain.coords[-1]))
    joints = [Point(point).buffer(RIVER_RIBBON_M) for point, count in ends.items() if count > 1]
    ribbon = unary_union(chains).buffer(RIVER_RIBBON_M, cap_style='flat')
    return unary_union([ribbon, *joints])


def split_large(polygon) -> list:
    """Большой водоём — кусками по сетке (в метрах)."""
    if polygon.area <= SPLIT_AREA_M2:
        return [polygon]
    west, south, east, north = polygon.bounds
    pieces = []
    for x in range(math.floor(west / SPLIT_CELL_M), math.ceil(east / SPLIT_CELL_M)):
        for y in range(math.floor(south / SPLIT_CELL_M), math.ceil(north / SPLIT_CELL_M)):
            cell = box(
                x * SPLIT_CELL_M, y * SPLIT_CELL_M, (x + 1) * SPLIT_CELL_M, (y + 1) * SPLIT_CELL_M
            )
            pieces += parts(polygon.intersection(cell))
    return pieces


def build_water(osm: dict, frame_deg: tuple, lat0: float) -> list[Polygon]:
    projection = Projection(lat0)
    frame = box(*frame_deg)
    lakes = unary_union(lake_areas(osm, lat0))
    sea = sea_area(osm, frame, projection)
    water_m = unary_union(
        [
            projection.to_meters(lakes),
            projection.to_meters(sea),
            river_ribbons(osm, lakes, projection),
        ]
    ).intersection(projection.to_meters(frame))

    polygons = []
    for part in parts(water_m):
        if part.area < MIN_AREA_M2:
            continue
        simple = part.simplify(SIMPLIFY_M, preserve_topology=True)
        polygons += [piece for piece in split_large(simple) if piece.area >= MIN_AREA_M2]
    return [orient(projection.to_degrees(polygon)) for polygon in polygons]


def to_feature(polygon: Polygon) -> dict:
    return {
        'type': 'Feature',
        'properties': {'kind': 'water'},
        'geometry': {'type': 'Polygon', 'coordinates': polygon_coordinates(polygon, COORD_DIGITS)},
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('city', choices=sorted(CITIES), help='slug города')
    parser.add_argument('--out', type=Path, help='записать сюда, не трогая данные города')
    args = parser.parse_args()

    slug = args.city
    folder = DATA / slug
    info = read_json(folder / 'city.json')
    west, south, east, north = city_frame(slug, info)
    lat0 = (south + north) / 2
    frame = (west - MARGIN_DEG, south - MARGIN_DEG, east + MARGIN_DEG, north + MARGIN_DEG)

    osm = cached(CACHE / f'{slug}-water-areas.json', lambda: overpass(water_query(frame)))
    polygons = build_water(osm, frame, lat0)
    water = feature_collection([to_feature(polygon) for polygon in polygons])
    size = write_json(args.out or folder / 'water.geojson', water)
    kx, ky = scale(lat0)
    area_km2 = sum(p.area for p in polygons) * kx * ky / 1e6
    print(f'{slug}: {len(polygons)} водоёмов, {area_km2:.1f} км², {size // 1024} КБ')
    if args.out:
        return

    copy_to_demo(slug, ('water.geojson',))
    if 'bbox' not in info:
        info['center'] = [round((west + east) / 2, 5), round(lat0, 5)]
        info['bbox'] = [round(value, 5) for value in (west, south, east, north)]
        write_json(folder / 'city.json', info)
        print('city.json: записаны приблизительные center и bbox')
    print(f'Дальше: python tools/city-data/build_districts.py {slug}')


if __name__ == '__main__':
    main()
