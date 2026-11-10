"""Районы города из OpenStreetMap -> districts.geojson и city.json.

Санкт-Петербург, Кёльн и Бристоль — официальное деление: район = отношение OSM целиком, вершины
OSM без упрощения и сглаживания. В Костанае официальных районов в OSM нет: дороги, железная дорога,
берега и контуры зон застройки режут город на кварталы, и каждый квартал целиком отходит району,
который занимал его раньше (--seed, по умолчанию текущий districts.geojson), — любая граница
района лежит на линии OSM. Из районов вырезается вода (water.geojson города).

Названия районов берутся из текущего districts.geojson; районы, которых нет в настройках города,
в результат не попадают. Пишет backend/data/cities/<slug>/ и копию для демо-режима фронтенда
(frontend/src/demo-data/cities/<slug>/). Сырые ответы Overpass складываются в backend/.osm-cache/ —
по ним же проверяет результат verify_city_data.py. Нужна shapely (requirements-dev.txt).

Запуск из корня репозитория:

    python backend/scripts/build_districts.py cologne
    python backend/scripts/build_districts.py kostanay --preview preview.png

После районов пересобираются улицы и плитки: build_streets.py, затем build_map_tiles.py.
"""

import argparse
import json
import math
import shutil
from collections import defaultdict
from pathlib import Path

import shapely
from build_streets import kind_of, overpass, pretty
from shapely import STRtree
from shapely.geometry import LineString, MultiPolygon, Polygon, box, shape
from shapely.geometry.polygon import orient
from shapely.ops import linemerge, polygonize, polygonize_full, unary_union

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'backend' / 'data' / 'cities'
DEMO = ROOT / 'frontend' / 'src' / 'demo-data' / 'cities'
CACHE = ROOT / 'backend' / '.osm-cache'

GRID = 1e-7  # сетка координат OSM: соседи получают общую границу из одних и тех же вершин
COORD_DIGITS = 7
METERS_PER_DEGREE = 111_320
MIN_PART_M2 = 20_000  # клочок суши меньше этого (щепка у берега, островок) в районы не входит
STITCH_M = 200  # разрыв кольца отношения OSM не длиннее этого сшивается по ближайшим концам
PALETTE_SIZE = 12
NEAR_M = 150  # районы ближе этого (через реку, протоку) — тоже соседи для раскраски

# Костанай: кварталы.
WHOLE_BLOCK_SHARE = 0.9  # крупный квартал (между магистралями) целиком отходит району
MIN_COVER_SHARE = 0.5  # мелкий квартал входит в город, если прежние районы покрывали его половину
ENCLOSED_SHARE = 0.9  # пустой квартал, почти целиком окружённый районами и водой, — пазуха
ENCLOSED_MAX_M2 = 300_000
SPIKE_SHARE = 0.6  # мелкий квартал, который больше чем на столько граничит с чужим районом, — ему
SPIKE_MAX_M2 = 30_000
STRIP_WIDTH_M = 60  # полоса уже этого и в STRIP_RATIO раз длиннее своей ширины — «узкая»
STRIP_RATIO = 8
STUB_SHARE = 0.15  # квартал на краю, который касается города меньшей долей границы, — отросток
MIN_ISLAND_M2 = 20_000  # отдельный клочок района на отшибе меньше этого в город не входит
ENCLAVE_SHARE = 0.25  # клочок меньше этой доли района, прижатый к другому району, отходит ему
SMOOTH_PASSES = 4
COARSE_KINDS = {'major', 'secondary', 'tertiary', 'rail'}
LINE_KEYS = 'highway|railway|waterway|barrier|landuse|natural|leisure|amenity|aeroway|man_made'
SHORE = {'water', 'coastline', 'riverbank'}

CITIES = {
    'saint-petersburg': {
        'query': (
            'area["name"="Санкт-Петербург"]["admin_level"="4"]->.a;'
            'relation(area.a)["boundary"="administrative"]["admin_level"="5"];'
        ),
        'districts': {
            'admiralteysky': 'Адмиралтейский район',
            'vasileostrovsky': 'Василеостровский район',
            'vyborgsky': 'Выборгский район',
            'kalininsky': 'Калининский район',
            'kirovsky': 'Кировский район',
            'kolpinsky': 'Колпинский район',
            'krasnogvardeysky': 'Красногвардейский район',
            'krasnoselsky': 'Красносельский район',
            'kronshtadtsky': 'Кронштадтский район',
            'kurortny': 'Курортный район',
            'moskovsky': 'Московский район',
            'nevsky': 'Невский район',
            'petrogradsky': 'Петроградский район',
            'petrodvortsovy': 'Петродворцовый район',
            'primorsky': 'Приморский район',
            'pushkinsky': 'Пушкинский район',
            'frunzensky': 'Фрунзенский район',
            'tsentralny': 'Центральный район',
        },
        'note': (
            'Районы — 18 административных районов Санкт-Петербурга в официальных границах '
            'OpenStreetMap (boundary=administrative, admin_level=5): вершины OSM без упрощения и '
            'сглаживания, вырезана только вода. Вода и улицы — тоже OpenStreetMap (ODbL).'
        ),
    },
    'cologne': {
        'query': (
            'area["name"="Köln"]["admin_level"="6"]->.a;'
            'relation(area.a)["boundary"="administrative"]["admin_level"="9"];'
        ),
        'districts': {
            'innenstadt': 'Innenstadt',
            'rodenkirchen': 'Rodenkirchen',
            'lindenthal': 'Lindenthal',
            'ehrenfeld': 'Ehrenfeld',
            'nippes': 'Nippes',
            'chorweiler': 'Chorweiler',
            'porz': 'Porz',
            'kalk': 'Kalk',
            'muelheim': 'Mülheim',
        },
        # Залив с зубцами на границе Эренфельда и Ниппеса у Хбф закрыт прямой между вершинами
        # зубцов (разметка пользователя 2026-11-10): залив отходит Эренфельду.
        'bays': [
            {
                'from': 'nippes',
                'to': 'ehrenfeld',
                'chord': [[6.9371207, 50.9594616], [6.940027, 50.9574462]],
            },
        ],
        'note': (
            'Районы — 9 городских округов Кёльна (Stadtbezirke) в официальных границах '
            'OpenStreetMap (boundary=administrative, admin_level=9): вершины OSM без упрощения и '
            'сглаживания, вырезана только вода; залив с зубцами между Эренфельдом и Ниппесом '
            'закрыт прямой. Вода и улицы — тоже OpenStreetMap (ODbL).'
        ),
    },
    'bristol': {
        'query': (
            'relation["boundary"="political"]["political_division"="ward"]'
            '(51.33,-3.13,51.56,-2.48);'
        ),
        'districts': {
            'ashley': 'Ashley Ward',
            'avonmouth': 'Avonmouth & Lawrence Weston Ward',
            'bedminster': 'Bedminster Ward',
            'bishopston': 'Bishopston & Ashley Down Ward',
            'bishopsworth': 'Bishopsworth Ward',
            'brislington-east': 'Brislington East Ward',
            'brislington-west': 'Brislington West Ward',
            'bristol-central': 'Central Ward',
            'clifton': 'Clifton Ward',
            'clifton-down': 'Clifton Down Ward',
            'cotham': 'Cotham Ward',
            'easton': 'Easton Ward',
            'eastville': 'Eastville Ward',
            'filwood': 'Filwood Ward',
            'frome-vale': 'Frome Vale Ward',
            'hartcliffe': 'Hartcliffe & Withywood Ward',
            'henbury': 'Henbury & Brentry Ward',
            'hengrove': 'Hengrove & Whitchurch Park Ward',
            'hillfields': 'Hillfields Ward',
            'horfield': 'Horfield Ward',
            'hotwells': 'Hotwells & Harbourside Ward',
            'knowle': 'Knowle Ward',
            'lawrence-hill': 'Lawrence Hill Ward',
            'lockleaze': 'Lockleaze Ward',
            'redland': 'Redland Ward',
            'southmead': 'Southmead Ward',
            'southville': 'Southville Ward',
            'st-george-central': 'St George Central Ward',
            'st-george-troopers-hill': 'St George Troopers Hill Ward',
            'st-george-west': 'St George West Ward',
            'stockwood': 'Stockwood Ward',
            'stoke-bishop': 'Stoke Bishop Ward',
            'westbury-on-trym': 'Westbury-on-Trym & Henleaze Ward',
            'windmill-hill': 'Windmill Hill Ward',
        },
        'note': (
            'Районы — 34 избирательных округа Бристоля (wards) в официальных границах '
            'OpenStreetMap (boundary=political, political_division=ward): вершины OSM без '
            'упрощения и сглаживания, вырезана только вода. Вода и улицы — тоже OpenStreetMap '
            '(ODbL).'
        ),
    },
    'kostanay': {
        'blocks': [
            'center',
            'vokzal',
            'narimanovka',
            'zapadny',
            'kzhbi',
            'khimik',
            'amangeldy',
            'dostyk',
            'kostanay-2',
            'aeroport',
            'perevalovka',
            'ksk',
            'zelenstroy',
            'uzkaya-koleya',
        ],
        # Замыкающие отрезки: там, где пользователь провёл границу, а линии OSM нет (2026-11-10).
        # Концы — узлы OSM (вершины районов) или точка в 2 м за линией OSM, чтобы отрезок её пересёк.
        'closures': [
            # Север Костаная-2: от дороги KP-4 к концу ж/д тупика, между тупиками и через выемку
            # к северо-восточному углу района.
            [[63.5365347, 53.2435922], [63.54471, 53.2483071]],
            [[63.54471, 53.2483071], [63.5423765, 53.2514269]],
            [[63.5423765, 53.2514269], [63.5542235, 53.2626708]],
            # Полоса Узкой Колеи между Костанаем-2 и Привокзальным отрезана от района.
            [[63.6258151, 53.2421489], [63.626495, 53.2417321]],
            # Узкие пальцы Достыка и Химика внутри Амангельды отрезаны у основания.
            [[63.5529387, 53.1404556], [63.5530109, 53.1407087]],
            [[63.6006967, 53.1515484], [63.600884, 53.151124]],
            # Дорога Химика, торчащая в Амангельды, отрезана по границе районов.
            [[63.5812923, 53.1539738], [63.5835962, 53.1550719]],
            # Полоса КСК вдоль дороги в Зеленстрое отделена от квартала, к которому примыкает.
            [[63.6816343, 53.2541912], [63.6817439, 53.254228]],
        ],
        'note': (
            'Районы — 14 жилых районов Костаная. Официального деления в OpenStreetMap нет, поэтому '
            'город разрезан на кварталы линиями OSM (улицы, железная дорога, берега, контуры зон '
            'застройки), и каждый квартал целиком входит в один район: любая граница района лежит '
            'на линии OSM. Вырезана только вода. Вода и улицы — тоже OpenStreetMap (ODbL).'
        ),
    },
}


def cached(path: Path, load) -> dict:
    """Ответ Overpass с диска или из сети (и на диск): сборка повторяется без сети."""
    if path.exists():
        return json.loads(path.read_text(encoding='utf-8'))
    data = load()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data), encoding='utf-8')
    return data


def scale(lat0: float) -> tuple[float, float]:
    """Метров в градусе долготы и широты у города."""
    return math.cos(math.radians(lat0)) * METERS_PER_DEGREE, METERS_PER_DEGREE


def area_m2(geometry, lat0: float) -> float:
    kx, ky = scale(lat0)
    return geometry.area * kx * ky


def parts(geometry) -> list[Polygon]:
    if geometry.is_empty:
        return []
    if isinstance(geometry, Polygon):
        return [geometry]
    return [polygon for part in getattr(geometry, 'geoms', []) for polygon in parts(part)]


def closed_rings(lines: list[LineString], lat0: float, name: str) -> list[Polygon]:
    """Полигоны из путей отношения. Концы путей в OSM иногда не сходятся — разрыв сшивается."""
    polygons, dangles, cuts, _ = polygonize_full(unary_union(lines))
    loose = [*dangles.geoms, *cuts.geoms]
    if not loose:
        return list(polygons.geoms)
    kx, ky = scale(lat0)
    merged = linemerge(unary_union(loose))
    chains = [merged] if isinstance(merged, LineString) else list(merged.geoms)
    bridges = []
    ends = [point for chain in chains for point in (chain.coords[0], chain.coords[-1])]
    while ends:
        a = ends.pop()
        b = min(ends, key=lambda p: math.hypot((p[0] - a[0]) * kx, (p[1] - a[1]) * ky))
        gap = math.hypot((b[0] - a[0]) * kx, (b[1] - a[1]) * ky)
        if gap > STITCH_M:
            raise SystemExit(f'{name}: граница в OSM разорвана на {gap:.0f} м — не сшить')
        ends.remove(b)
        if gap:
            bridges.append(LineString([a, b]))
            print(f'{name}: разрыв границы {gap:.1f} м сшит')
    return list(polygonize(unary_union([*lines, *bridges])))


def relation_area(relation: dict, lat0: float):
    """Территория отношения OSM: внешние кольца минус внутренние."""
    name = relation['tags'].get('name', str(relation['id']))
    lines: dict[bool, list[LineString]] = {True: [], False: []}
    for member in relation['members']:
        geometry = member.get('geometry') or []
        if member['type'] == 'way' and len(geometry) > 1:
            line = LineString([(node['lon'], node['lat']) for node in geometry])
            lines[member.get('role') != 'inner'].append(line)
    outer = unary_union(closed_rings(lines[True], lat0, name))
    if not lines[False]:
        return outer
    return outer.difference(unary_union(closed_rings(lines[False], lat0, name)))


def load_water(folder: Path, bounds: tuple[float, float, float, float]):
    """Вода города одним полигоном (в файле крупные водоёмы разрезаны сеткой) в рамке районов."""
    frame = box(*bounds).buffer(0.01)
    collection = json.loads((folder / 'water.geojson').read_text(encoding='utf-8'))
    polygons = [shapely.make_valid(shape(f['geometry'])) for f in collection['features']]
    merged = unary_union([p for p in polygons if p.intersects(frame)]).intersection(frame)
    # make_valid и пересечение оставляют среди полигонов линии и точки — они воде не нужны.
    return unary_union(parts(merged))


def faces_of(lines: list) -> list[Polygon]:
    """Грани линейной сети, узлованной на сетке координат OSM."""
    return list(polygonize(shapely.union_all(lines, grid_size=GRID)))


def dry(faces: list[Polygon], water) -> list[bool]:
    """Грань — суша (её целиком ограничивают линии, среди которых контур воды)."""
    shapely.prepare(water)
    points = shapely.point_on_surface(faces)
    return [not wet for wet in shapely.contains(water, points)]


def close_bay(areas: dict, bay: dict) -> None:
    """Залив соседа между хордой и границей района (оба конца хорды — его вершины) отходит району."""
    chord = LineString(bay['chord'])
    pieces = polygonize(shapely.union_all([chord, areas[bay['to']].boundary], grid_size=GRID))
    shapely.prepare(areas[bay['from']])
    moved = [
        piece
        for piece in pieces
        if areas[bay['from']].contains(piece.representative_point())
        and piece.boundary.intersection(chord).length > 0
    ]
    if not moved:
        raise SystemExit(f'залив {bay["from"]} → {bay["to"]}: хорда не замыкает залив')
    gulf = unary_union(moved)
    areas[bay['to']] = unary_union([areas[bay['to']], gulf])
    areas[bay['from']] = areas[bay['from']].difference(gulf)


def official_districts(config: dict, slug: str, folder: Path, lat0: float):
    osm = cached(
        CACHE / f'{slug}-boundaries.json',
        lambda: overpass(f'[out:json][timeout:300];{config["query"]}out geom;'),
    )
    by_name = {e['tags'].get('name'): e for e in osm['elements'] if e['type'] == 'relation'}
    areas = {}
    for district, name in config['districts'].items():
        if name not in by_name:
            raise SystemExit(f'{slug}: в OSM нет границы «{name}»')
        areas[district] = relation_area(by_name[name], lat0)
    for bay in config.get('bays', []):
        close_bay(areas, bay)
    bounds = unary_union(list(areas.values())).bounds
    water = load_water(folder, bounds)

    faces = faces_of([*(area.boundary for area in areas.values()), water.boundary])
    land = dry(faces, water)
    slugs = list(areas)
    tree = STRtree([areas[s] for s in slugs])
    points = shapely.point_on_surface(faces)
    owner: dict[int, int] = {}
    for face, district in zip(*tree.query(points, predicate='within'), strict=True):
        owner[int(face)] = int(district)
    groups = defaultdict(list)
    for index, district in owner.items():
        if land[index]:
            groups[slugs[district]].append(faces[index])
    return {s: shapely.coverage_union_all(groups[s]) for s in slugs}, areas, water


def block_lines(
    slug: str, bounds: tuple[float, float, float, float], water, closures: list
) -> list[list]:
    """Линии OSM, по которым могут идти границы районов, тремя уровнями: магистрали, железная
    дорога, берега и замыкающие отрезки; улицы; всё остальное (проезды, тропы, ограды, водотоки,
    контуры участков)."""
    west, south, east, north = bounds
    area = f'{south - 0.02},{west - 0.02},{north + 0.02},{east + 0.02}'
    osm = cached(
        CACHE / f'{slug}-lines.json',
        lambda: overpass(
            f'[out:json][timeout:300];way[~"^({LINE_KEYS})$"~"."]({area});out tags geom;'
        ),
    )
    levels: list[list] = [[water.boundary, *map(LineString, closures)], [], []]
    for element in osm['elements']:
        tags = element.get('tags', {})
        points = [(node['lon'], node['lat']) for node in element.get('geometry', [])]
        # Берега — из water.geojson: тот же контур, что на карте.
        if len(points) < 2 or tags.get('natural') in SHORE or tags.get('waterway') in SHORE:
            continue
        kind = None if tags.get('service') else kind_of(tags)
        level = 0 if kind in COARSE_KINDS else 1 if kind == 'local' else 2
        levels[level].append(LineString(points))
    return levels


def neighbours(faces: list[Polygon], lat0: float) -> list[dict[int, float]]:
    """Соседи каждой грани и длина общей границы в метрах (грани узлованы — рёбра совпадают)."""
    kx, ky = scale(lat0)
    edges: dict[tuple, list[int]] = defaultdict(list)
    for index, face in enumerate(faces):
        for ring in (face.exterior, *face.interiors):
            coords = list(ring.coords)
            for a, b in zip(coords, coords[1:], strict=False):
                edges[(a, b) if a < b else (b, a)].append(index)
    result: list[dict[int, float]] = [defaultdict(float) for _ in faces]
    for (a, b), owners in edges.items():
        length = math.hypot((b[0] - a[0]) * kx, (b[1] - a[1]) * ky)
        first, second = owners if len(owners) == 2 else (owners[0], -1)
        result[first][second] += length
        if second >= 0:
            result[second][first] += length
    return result


def is_strip(face: Polygon, lat0: float) -> bool:
    """Узкая длинная полоса: ширина и длина — как у прямоугольника той же площади и периметра."""
    kx, ky = scale(lat0)
    area = face.area * kx * ky
    perimeter = shapely.transform(face, lambda c: c * [kx, ky]).length
    width = (perimeter - math.sqrt(max(perimeter**2 - 16 * area, 0))) / 4
    return width < STRIP_WIDTH_M and area > STRIP_RATIO * width**2


def block_districts(config: dict, slug: str, folder: Path, seed_path: Path, lat0: float):
    slugs = config['blocks']
    collection = json.loads(seed_path.read_text(encoding='utf-8'))
    seeds = {
        f['properties']['slug']: shapely.make_valid(shape(f['geometry']))
        for f in collection['features']
        if f['properties']['slug'] in slugs
    }
    if set(seeds) != set(slugs):
        raise SystemExit(f'{slug}: в {seed_path} нет районов {sorted(set(slugs) - set(seeds))}')
    bounds = unary_union(list(seeds.values())).bounds
    water = load_water(folder, bounds)
    levels = block_lines(slug, bounds, water, config.get('closures', []))

    # Грани самой мелкой сети — «атомы»; кварталы крупных уровней складываются из них.
    faces = faces_of([line for level in levels for line in level])
    land = dry(faces, water)
    points = shapely.point_on_surface(faces)
    blocks_of = []
    for depth in (1, 2):
        blocks = faces_of([line for level in levels[:depth] for line in level])
        ids = [-1] * len(faces)
        for face, block in zip(*STRtree(blocks).query(points, predicate='within'), strict=True):
            ids[int(face)] = int(block)
        blocks_of.append(ids)

    # Сколько каждой грани занимал каждый прежний район.
    seed_list = [seeds[s] for s in slugs]
    cover: list[dict[int, float]] = [{} for _ in faces]
    for face, district in zip(
        *STRtree(seed_list).query(faces, predicate='intersects'), strict=True
    ):
        if land[face]:
            shared = faces[face].intersection(seed_list[district]).area
            if shared > 0:
                cover[face][int(district)] = shared

    def whole(ids: list[int]) -> dict[int, int]:
        """Кварталы уровня, которые почти целиком занимал один район: квартал → район."""
        area: dict[int, float] = defaultdict(float)
        shares: dict[int, dict[int, float]] = defaultdict(lambda: defaultdict(float))
        for index, face in enumerate(faces):
            if land[index] and ids[index] >= 0:
                area[ids[index]] += face.area
                for district, shared in cover[index].items():
                    shares[ids[index]][district] += shared
        result = {}
        for block, by_district in shares.items():
            district, shared = max(by_district.items(), key=lambda item: item[1])
            if shared >= WHOLE_BLOCK_SHARE * area[block]:
                result[block] = district
        return result

    owners = [whole(ids) for ids in blocks_of]
    label = [-1] * len(faces)
    for index, face in enumerate(faces):
        if not land[index]:
            continue
        for ids, owner in zip(blocks_of, owners, strict=True):
            if ids[index] in owner:
                label[index] = owner[ids[index]]
                break
        else:
            # Узкая полоса вдоль путей или дороги тянется далеко за город — входит только целиком.
            share = WHOLE_BLOCK_SHARE if is_strip(face, lat0) else MIN_COVER_SHARE
            if cover[index] and sum(cover[index].values()) >= share * face.area:
                label[index] = max(cover[index].items(), key=lambda item: item[1])[0]

    near = neighbours(faces, lat0)

    def borders(index: int, labels: list[int]) -> tuple[dict[int, float], float, float]:
        """Длина границы грани с каждым районом, с водой и с пустой землёй."""
        by_district: dict[int, float] = defaultdict(float)
        wet = empty = 0.0
        for other, length in near[index].items():
            if other < 0:
                empty += length
            elif not land[other]:
                wet += length
            elif labels[other] < 0:
                empty += length
            else:
                by_district[labels[other]] += length
        return by_district, wet, empty

    for _ in range(SMOOTH_PASSES):
        previous = list(label)
        for index, face in enumerate(faces):
            if not land[index]:
                continue
            by_district, wet, empty = borders(index, previous)
            total = sum(by_district.values()) + wet + empty
            if not total:
                continue
            best, length = max(by_district.items(), key=lambda item: item[1], default=(-1, 0.0))
            if previous[index] < 0:
                # Пазуха: пустой квартал, который районы и вода окружают почти целиком.
                enclosed = (total - empty) >= ENCLOSED_SHARE * total
                if best >= 0 and enclosed and area_m2(face, lat0) <= ENCLOSED_MAX_M2:
                    label[index] = best
            elif sum(by_district.values()) < STUB_SHARE * total and empty > wet:
                # Отросток: квартал держится за город коротким концом и торчит в пустую землю.
                label[index] = -1
            elif best != previous[index] and length >= SPIKE_SHARE * total:
                # Зубец: мелкий квартал торчит в чужой район — отходит ему.
                if area_m2(face, lat0) <= SPIKE_MAX_M2:
                    label[index] = best

    # Район — один кусок: клочок, прижатый к другому району, отходит ему (соседу с самой длинной
    # общей границей), мелкий клочок на отшибе в город не входит.
    for district in range(len(slugs)):
        own = [i for i, value in enumerate(label) if value == district]
        pieces = parts(shapely.coverage_union_all([faces[i] for i in own]))
        if len(pieces) < 2:
            continue
        main = max(pieces, key=lambda piece: piece.area)
        for piece in pieces:
            if piece is main:
                continue
            shapely.prepare(piece)
            inside = [i for i in own if piece.contains(shapely.point_on_surface(faces[i]))]
            around: dict[int, float] = defaultdict(float)
            for index in inside:
                for other, length in borders(index, label)[0].items():
                    if other != district:
                        around[other] += length
            if around and piece.area < ENCLAVE_SHARE * main.area:
                target = max(around.items(), key=lambda item: item[1])[0]
            elif area_m2(piece, lat0) < MIN_ISLAND_M2:
                target = -1
            else:
                continue
            for index in inside:
                label[index] = target

    groups = defaultdict(list)
    for index, district in enumerate(label):
        if district >= 0:
            groups[slugs[district]].append(faces[index])
    return {s: shapely.coverage_union_all(groups[s]) for s in slugs}, seeds, water


def clean(raw: dict, lat0: float) -> dict[str, MultiPolygon]:
    """Районы без щепок; кольца — в порядке GeoJSON (внешнее против часовой стрелки).

    Щепка — отдельный клочок суши (все районы вместе) меньше MIN_PART_M2: остров или полоса берега,
    которую делят два района, меряется целиком, а не по кускам каждого района."""
    masses = parts(shapely.coverage_union_all([p for g in raw.values() for p in parts(g)]))
    tree = STRtree(masses)
    result = {}
    for slug, geometry in raw.items():
        pieces = parts(geometry)
        points = shapely.point_on_surface(pieces)
        mass_of = dict(zip(*tree.query(points, predicate='within'), strict=True))
        kept = [
            orient(piece)
            for index, piece in enumerate(pieces)
            if area_m2(masses[mass_of[index]], lat0) >= MIN_PART_M2
        ]
        kept.sort(key=lambda part: -part.area)
        result[slug] = MultiPolygon(kept)
    return result


def colorize(districts: dict[str, MultiPolygon], previous: dict[str, int], lat0: float):
    """Соседи не получают один цвет; прежний цвет района остаётся, если не спорит с соседом."""
    slugs = list(districts)
    reach = NEAR_M / METERS_PER_DEGREE
    tree = STRtree([districts[s] for s in slugs])
    adjacent: dict[str, set[str]] = {s: set() for s in slugs}
    near = tree.query([districts[s] for s in slugs], distance=reach, predicate='dwithin')
    for a, b in zip(*near, strict=True):
        if a != b:
            adjacent[slugs[a]].add(slugs[b])
    palette: dict[str, int] = {}
    for s in sorted(slugs, key=lambda item: -len(adjacent[item])):
        taken = {palette[n] for n in adjacent[s] if n in palette}
        if previous.get(s) and previous[s] not in taken:
            palette[s] = previous[s]
            continue
        used = list(palette.values())
        free = [c for c in range(1, PALETTE_SIZE + 1) if c not in taken]
        palette[s] = min(free, key=used.count)
    return palette


def ring_coords(ring) -> list[list[float]]:
    return [[round(x, COORD_DIGITS), round(y, COORD_DIGITS)] for x, y in ring.coords]


def to_feature(properties: dict, geometry: MultiPolygon) -> dict:
    coordinates = [
        [ring_coords(part.exterior), *(ring_coords(hole) for hole in part.interiors)]
        for part in geometry.geoms
    ]
    return {
        'type': 'Feature',
        'properties': properties,
        'geometry': {'type': 'MultiPolygon', 'coordinates': coordinates},
    }


def draw_preview(
    path: Path, districts: dict, palette: dict, water, before: dict | None, lat0: float
) -> None:
    """Картинка для сверки глазами: районы, вода и (тонкой линией) прежние контуры."""
    from PIL import Image, ImageDraw  # noqa: PLC0415 — Pillow нужна только для превью

    colors = [(196, 120, 96), (120, 160, 200), (150, 190, 120), (210, 180, 100), (160, 130, 190)]
    colors += [(110, 180, 170), (200, 140, 170), (140, 150, 110), (220, 150, 90), (120, 140, 180)]
    colors += [(180, 200, 140), (170, 120, 120)]
    west, south, east, north = unary_union(list(districts.values())).buffer(0.01).bounds
    kx, ky = scale(lat0)
    size = 2400
    ppd = size / max((east - west) * kx, (north - south) * ky)

    def px(point) -> tuple[float, float]:
        return ((point[0] - west) * kx * ppd, (north - point[1]) * ky * ppd)

    ground = (236, 240, 232)
    image = Image.new(
        'RGB', (round((east - west) * kx * ppd), round((north - south) * ky * ppd)), ground
    )
    draw = ImageDraw.Draw(image)

    def fill(geometry, color, outline=None) -> None:
        # Каждый кусок — своим слоем: дыра (озеро, остров в воде) не закрашивает то, что под ней.
        for part in parts(geometry):
            mask = Image.new('L', image.size, 0)
            pen = ImageDraw.Draw(mask)
            pen.polygon([px(p) for p in part.exterior.coords], fill=255)
            for hole in part.interiors:
                pen.polygon([px(p) for p in hole.coords], fill=0)
            image.paste(color, mask=mask)
            if outline:
                for ring in (part.exterior, *part.interiors):
                    draw.line([px(p) for p in ring.coords], fill=outline, width=1)

    for slug, geometry in districts.items():
        fill(geometry, colors[palette[slug] - 1], (255, 255, 255))
    fill(water.intersection(box(west, south, east, north)), (150, 200, 235))
    for geometry in (before or {}).values():
        for part in parts(geometry):
            draw.line([px(p) for p in part.exterior.coords], fill=(180, 30, 30), width=1)
    for slug, geometry in districts.items():
        if not geometry.is_empty:
            draw.text(
                px(geometry.geoms[0].representative_point().coords[0]), slug, fill=(20, 20, 20)
            )
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('city', choices=sorted(CITIES), help='slug города')
    parser.add_argument('--seed', type=Path, help='прежние районы Костаная (по умолчанию текущие)')
    parser.add_argument('--preview', type=Path, help='сохранить картинку для сверки (PNG)')
    args = parser.parse_args()

    config = CITIES[args.city]
    folder = DATA / args.city
    city = json.loads((folder / 'city.json').read_text(encoding='utf-8'))
    current = json.loads((folder / 'districts.geojson').read_text(encoding='utf-8'))
    properties = {f['properties']['slug']: f['properties'] for f in current['features']}
    lat0 = city['center'][1]

    if 'blocks' in config:
        seed = args.seed or folder / 'districts.geojson'
        raw, before, water = block_districts(config, args.city, folder, seed, lat0)
    else:
        raw, before, water = official_districts(config, args.city, folder, lat0)
    districts = clean(raw, lat0)
    empty = [slug for slug, geometry in districts.items() if geometry.is_empty]
    if empty:
        raise SystemExit(f'{args.city}: у районов нет территории: {empty}')

    palette = colorize(districts, {s: p['palette'] for s, p in properties.items()}, lat0)
    features = []
    print(f'{"район":28}{"исходно, км²":>14}{"стало, км²":>12}{"кусков":>8}{"вершин":>9}')
    for slug, geometry in districts.items():
        features.append(to_feature({**properties[slug], 'palette': palette[slug]}, geometry))
        vertices = sum(
            len(ring.coords) for part in geometry.geoms for ring in (part.exterior, *part.interiors)
        )
        was = area_m2(before[slug], lat0) / 1e6
        now = area_m2(geometry, lat0) / 1e6
        print(f'{slug:28}{was:14.2f}{now:12.2f}{len(geometry.geoms):8}{vertices:9}')

    union = unary_union(list(districts.values()))
    west, south, east, north = union.bounds
    city['center'] = [round(union.centroid.x, 5), round(union.centroid.y, 5)]
    city['bbox'] = [
        math.floor(west * 1e5) / 1e5,
        math.floor(south * 1e5) / 1e5,
        math.ceil(east * 1e5) / 1e5,
        math.ceil(north * 1e5) / 1e5,
    ]
    city['note'] = config['note']

    text = pretty({'type': 'FeatureCollection', 'features': features}) + '\n'
    (folder / 'districts.geojson').write_text(text, encoding='utf-8', newline='\n')
    (folder / 'city.json').write_text(pretty(city) + '\n', encoding='utf-8', newline='\n')
    for name in ('districts.geojson', 'city.json', 'water.geojson'):
        shutil.copyfile(folder / name, DEMO / args.city / name)
    print(f'{args.city}: {len(features)} районов, {len(text) // 1024} КБ, центр {city["center"]}')

    if args.preview:
        seeds = before if 'blocks' in config else None
        draw_preview(args.preview, districts, palette, water, seeds, lat0)
    print(f'Дальше: python backend/scripts/build_streets.py {args.city}, затем build_map_tiles.py')


if __name__ == '__main__':
    main()
