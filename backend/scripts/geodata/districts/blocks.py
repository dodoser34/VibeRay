"""Районы из кварталов: город без официального деления в OSM (Костанай).

Линии OSM (дороги, железная дорога, берега, ограды, контуры участков) режут город на грани. Каждая
грань целиком отходит району, который занимал её раньше (затравка — прежний districts.geojson),
поэтому любая граница района лежит на линии OSM. Порядок работы:

1. Грани трёх уровней: крупные кварталы между магистралями, кварталы между улицами и самые мелкие
   грани всей сети. Крупный квартал, почти целиком занятый одним районом, отходит ему целиком.
2. Остальные грани отходят району, который покрывал хотя бы половину грани.
3. Несколько проходов сглаживания: пазухи заполняются, отростки и зубцы отрезаются.
4. Район — один кусок: оторванный клочок отходит соседу или выбрасывается.
"""

import json
import math
from collections import defaultdict
from pathlib import Path

import shapely
from shapely import STRtree
from shapely.geometry import LineString, Polygon, shape
from shapely.ops import unary_union

from geodata.districts.faces import faces_of, land_mask, load_water
from geodata.geometry import area_m2, parts, scale
from geodata.osm import cached, overpass, way_points
from geodata.paths import CACHE
from geodata.roads import kind_of

WHOLE_BLOCK_SHARE = 0.9  # квартал, который район занимал на столько, отходит ему целиком
MIN_COVER_SHARE = 0.5  # мелкая грань входит в город, если прежние районы покрывали её половину
ENCLOSED_SHARE = 0.9  # пустая грань, почти целиком окружённая районами и водой, — пазуха
ENCLOSED_MAX_M2 = 300_000
SPIKE_SHARE = 0.6  # мелкая грань, которая больше чем на столько граничит с чужим районом, — его
SPIKE_MAX_M2 = 30_000
STUB_SHARE = 0.15  # грань на краю, которая касается города меньшей долей границы, — отросток
STRIP_WIDTH_M = 60  # полоса уже этого и в STRIP_RATIO раз длиннее своей ширины — «узкая»
STRIP_RATIO = 8
MIN_ISLAND_M2 = 20_000  # отдельный клочок района на отшибе меньше этого в город не входит
ENCLAVE_SHARE = 0.25  # клочок меньше этой доли района, прижатый к другому району, отходит ему
SMOOTH_PASSES = 4

LINES_MARGIN_DEG = 0.02
LINE_KEYS = 'highway|railway|waterway|barrier|landuse|natural|leisure|amenity|aeroway|man_made'
COARSE_KINDS = {'major', 'secondary', 'tertiary', 'rail'}
SHORE = {'water', 'coastline', 'riverbank'}
NO_DISTRICT = -1


def load_seeds(seed_path: Path, slugs: list[str]) -> dict:
    """Прежние районы (затравка): slug → полигон."""
    collection = json.loads(seed_path.read_text(encoding='utf-8'))
    seeds = {
        f['properties']['slug']: shapely.make_valid(shape(f['geometry']))
        for f in collection['features']
        if f['properties']['slug'] in slugs
    }
    if set(seeds) != set(slugs):
        raise SystemExit(f'в {seed_path} нет районов {sorted(set(slugs) - set(seeds))}')
    return seeds


def block_lines(slug: str, bounds: tuple, water, closures: list) -> list[list]:
    """Линии, по которым могут идти границы районов, тремя уровнями: магистрали, железная
    дорога, берега и замыкающие отрезки; улицы; всё остальное (проезды, тропы, ограды, водотоки,
    контуры участков)."""
    west, south, east, north = bounds
    m = LINES_MARGIN_DEG
    area = f'{south - m},{west - m},{north + m},{east + m}'
    osm = cached(
        CACHE / f'{slug}-lines.json',
        lambda: overpass(
            f'[out:json][timeout:300];way[~"^({LINE_KEYS})$"~"."]({area});out tags geom;'
        ),
    )
    # Берега — из water.geojson: тот же контур, что у воды на карте.
    levels: list[list] = [[water.boundary, *map(LineString, closures)], [], []]
    for element in osm['elements']:
        tags = element.get('tags', {})
        points = way_points(element)
        if len(points) < 2 or tags.get('natural') in SHORE or tags.get('waterway') in SHORE:
            continue
        kind = None if tags.get('service') else kind_of(tags)
        level = 0 if kind in COARSE_KINDS else 1 if kind == 'local' else 2
        levels[level].append(LineString(points))
    return levels


def is_strip(face: Polygon, lat0: float) -> bool:
    """Узкая длинная полоса: ширина и длина — как у прямоугольника той же площади и периметра."""
    kx, ky = scale(lat0)
    area = face.area * kx * ky
    perimeter = shapely.transform(face, lambda c: c * [kx, ky]).length
    width = (perimeter - math.sqrt(max(perimeter**2 - 16 * area, 0))) / 4
    return width < STRIP_WIDTH_M and area > STRIP_RATIO * width**2


class Blocks:
    """Город, разрезанный линиями OSM на грани. Грани самой мелкой сети — «атомы»: кварталы
    крупных уровней складываются из них, район — тоже."""

    def __init__(self, levels: list[list], water, lat0: float) -> None:
        self.lat0 = lat0
        self.faces = faces_of([line for level in levels for line in level])
        self.land = land_mask(self.faces, water)
        points = shapely.point_on_surface(self.faces)
        # Номер квартала каждого уровня, в который входит грань (-1 — не входит ни в один).
        self.block_ids = []
        for depth in (1, 2):
            blocks = faces_of([line for level in levels[:depth] for line in level])
            ids = [-1] * len(self.faces)
            inside = STRtree(blocks).query(points, predicate='within')
            for face, block in zip(*inside, strict=True):
                ids[int(face)] = int(block)
            self.block_ids.append(ids)
        self.near = self.neighbours()

    def neighbours(self) -> list[dict[int, float]]:
        """Соседи каждой грани и длина общей границы в метрах; -1 — край сети. Грани узлованы,
        поэтому общее ребро у соседей одно и то же."""
        kx, ky = scale(self.lat0)
        edges: dict[tuple, list[int]] = defaultdict(list)
        for index, face in enumerate(self.faces):
            for ring in (face.exterior, *face.interiors):
                coords = list(ring.coords)
                for a, b in zip(coords, coords[1:], strict=False):
                    edges[(a, b) if a < b else (b, a)].append(index)
        result: list[dict[int, float]] = [defaultdict(float) for _ in self.faces]
        for (a, b), owners in edges.items():
            length = math.hypot((b[0] - a[0]) * kx, (b[1] - a[1]) * ky)
            first, second = owners if len(owners) == 2 else (owners[0], -1)
            result[first][second] += length
            if second >= 0:
                result[second][first] += length
        return result

    def borders(self, index: int, labels: list[int]) -> tuple[dict[int, float], float, float]:
        """Длина границы грани с каждым районом, с водой и с пустой землёй (метры)."""
        by_district: dict[int, float] = defaultdict(float)
        wet = empty = 0.0
        for other, length in self.near[index].items():
            if other < 0:
                empty += length
            elif not self.land[other]:
                wet += length
            elif labels[other] < 0:
                empty += length
            else:
                by_district[labels[other]] += length
        return by_district, wet, empty


def seed_cover(blocks: Blocks, seed_list: list) -> list[dict[int, float]]:
    """Сколько площади каждой грани-суши занимал каждый прежний район (в градусах²)."""
    cover: list[dict[int, float]] = [{} for _ in blocks.faces]
    hits = STRtree(seed_list).query(blocks.faces, predicate='intersects')
    for face, district in zip(*hits, strict=True):
        if blocks.land[face]:
            shared = blocks.faces[face].intersection(seed_list[district]).area
            if shared > 0:
                cover[face][int(district)] = shared
    return cover


def whole_blocks(blocks: Blocks, ids: list[int], cover: list[dict]) -> dict[int, int]:
    """Кварталы уровня, которые почти целиком занимал один район: квартал → район."""
    area: dict[int, float] = defaultdict(float)
    shares: dict[int, dict[int, float]] = defaultdict(lambda: defaultdict(float))
    for index, face in enumerate(blocks.faces):
        if blocks.land[index] and ids[index] >= 0:
            area[ids[index]] += face.area
            for district, shared in cover[index].items():
                shares[ids[index]][district] += shared
    result = {}
    for block, by_district in shares.items():
        district, shared = max(by_district.items(), key=lambda item: item[1])
        if shared >= WHOLE_BLOCK_SHARE * area[block]:
            result[block] = district
    return result


def first_labels(blocks: Blocks, cover: list[dict]) -> list[int]:
    """Район каждой грани по затравке: сначала целые кварталы, затем отдельные грани."""
    owners = [whole_blocks(blocks, ids, cover) for ids in blocks.block_ids]
    labels = [NO_DISTRICT] * len(blocks.faces)
    for index, face in enumerate(blocks.faces):
        if not blocks.land[index]:
            continue
        for ids, owner in zip(blocks.block_ids, owners, strict=True):
            if ids[index] in owner:
                labels[index] = owner[ids[index]]
                break
        else:
            # Узкая полоса вдоль путей или дороги тянется далеко за город — входит только целиком.
            share = WHOLE_BLOCK_SHARE if is_strip(face, blocks.lat0) else MIN_COVER_SHARE
            if cover[index] and sum(cover[index].values()) >= share * face.area:
                labels[index] = max(cover[index].items(), key=lambda item: item[1])[0]
    return labels


def smooth(blocks: Blocks, labels: list[int]) -> None:
    """Проходы сглаживания: каждый смотрит на районы соседей по итогам прошлого прохода."""
    for _ in range(SMOOTH_PASSES):
        previous = list(labels)
        for index, face in enumerate(blocks.faces):
            if not blocks.land[index]:
                continue
            by_district, wet, empty = blocks.borders(index, previous)
            total = sum(by_district.values()) + wet + empty
            if not total:
                continue
            best, length = max(by_district.items(), key=lambda item: item[1], default=(-1, 0.0))
            if previous[index] < 0:
                # Пазуха: пустая грань, которую районы и вода окружают почти целиком.
                enclosed = (total - empty) >= ENCLOSED_SHARE * total
                if best >= 0 and enclosed and area_m2(face, blocks.lat0) <= ENCLOSED_MAX_M2:
                    labels[index] = best
            elif sum(by_district.values()) < STUB_SHARE * total and empty > wet:
                # Отросток: грань держится за город коротким концом и торчит в пустую землю.
                labels[index] = NO_DISTRICT
            elif best != previous[index] and length >= SPIKE_SHARE * total:
                # Зубец: мелкая грань торчит в чужой район — отходит ему.
                if area_m2(face, blocks.lat0) <= SPIKE_MAX_M2:
                    labels[index] = best


def join_pieces(blocks: Blocks, labels: list[int], count: int) -> None:
    """Район — один кусок: клочок, прижатый к другому району, отходит ему (соседу с самой длинной
    общей границей), мелкий клочок на отшибе в город не входит."""
    for district in range(count):
        own = [i for i, value in enumerate(labels) if value == district]
        pieces = parts(shapely.coverage_union_all([blocks.faces[i] for i in own]))
        if len(pieces) < 2:
            continue
        main = max(pieces, key=lambda piece: piece.area)
        for piece in pieces:
            if piece is main:
                continue
            shapely.prepare(piece)
            inside = [i for i in own if piece.contains(shapely.point_on_surface(blocks.faces[i]))]
            around: dict[int, float] = defaultdict(float)
            for index in inside:
                for other, length in blocks.borders(index, labels)[0].items():
                    if other != district:
                        around[other] += length
            if around and piece.area < ENCLAVE_SHARE * main.area:
                target = max(around.items(), key=lambda item: item[1])[0]
            elif area_m2(piece, blocks.lat0) < MIN_ISLAND_M2:
                target = NO_DISTRICT
            else:
                continue
            for index in inside:
                labels[index] = target


def block_districts(slug: str, config: dict, folder: Path, seed_path: Path, lat0: float):
    """Районы города: (районы из граней, затравка, вода)."""
    slugs = config['blocks']
    seeds = load_seeds(seed_path, slugs)
    bounds = unary_union(list(seeds.values())).bounds
    water = load_water(folder, bounds)
    blocks = Blocks(block_lines(slug, bounds, water, config.get('closures', [])), water, lat0)

    labels = first_labels(blocks, seed_cover(blocks, [seeds[s] for s in slugs]))
    smooth(blocks, labels)
    join_pieces(blocks, labels, len(slugs))

    groups = defaultdict(list)
    for index, district in enumerate(labels):
        if district >= 0:
            groups[slugs[district]].append(blocks.faces[index])
    districts = {s: shapely.coverage_union_all(groups[s]) for s in slugs}
    return districts, seeds, water
