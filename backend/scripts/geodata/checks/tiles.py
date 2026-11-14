"""Проверки того, что видит сайт.

T1  центр плиток — центр города; случайные точки дорог закрашены на плитках и есть
    в векторных кусках
C1  копия данных для демо-режима фронтенда побайтно равна данным бэкенда
"""

import math
import random

import numpy as np
from PIL import Image

from build_map_tiles import FINEST_MPP, ROADS, TILE_PX, VECTOR_UNIT_M
from geodata.checks.city import City
from geodata.checks.measure import SEED, distances, tree_of
from geodata.checks.report import Report
from geodata.checks.streets import Streets
from geodata.geometry import scale
from geodata.output import DEMO_FILES, read_json
from geodata.paths import DEMO, MAPS

TILE_SHARE = 0.995
VECTOR_M = 0.2
TILE_SAMPLE = 2_000


def check_tiles(city: City, report: Report, streets: Streets) -> None:
    folder = MAPS / city.slug
    manifest = read_json(folder / 'tiles.json')
    report.add(
        'T1',
        'центр плиток = центр города',
        f'{manifest["center"]} и {city.info["center"]}',
        'совпадают',
        manifest['center'] == city.info['center'],
    )

    samples = road_samples(manifest['center'], streets)
    tile_km = TILE_PX * FINEST_MPP / 1000
    have = {tuple(tile) for tile in manifest['levels'][0]['tiles']}
    cells = {tuple(cell) for cell in manifest['vector']}
    channel_of = {kind: 'RGB'.index(channel) for kind, channel, *_ in ROADS}
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
                chunks[tile] = read_json(folder / 'vector' / f'{tile[0]}_{tile[1]}.json')
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


def road_samples(center: list[float], streets: Streets) -> list[tuple[str, np.ndarray]]:
    """Середины случайных линий дорог в районах: (класс, точка в км от центра плиток).
    Железная дорога на плитках — пунктир, точка может попасть в пробел, поэтому её нет."""
    lon0, lat0 = center
    km_per_degree = np.array(scale(lat0)) / 1000
    channels = {kind for kind, *_ in ROADS}
    samples = []
    for kind, lines in streets.by_kind.items():
        if kind == 'rail' or kind not in channels:
            continue
        for owner, line in lines:
            if owner is not None:
                middle = line[len(line) // 2]
                samples.append((kind, (middle - [lon0, lat0]) * km_per_degree))
    return random.Random(SEED).sample(samples, min(TILE_SAMPLE, len(samples)))


def check_copies(city: City, report: Report) -> None:
    differ = [
        name
        for name in DEMO_FILES
        if (city.folder / name).read_bytes() != (DEMO / city.slug / name).read_bytes()
    ]
    report.add(
        'C1',
        'копия для демо-режима фронтенда = данные бэкенда',
        'совпадают' if not differ else f'расходятся: {", ".join(differ)}',
        'побайтно',
        not differ,
    )
