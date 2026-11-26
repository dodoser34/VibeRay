"""W1: районы не налезают на воду, а берег у районов совпадает с берегами OSM.

Берега сверяются с отдельным ответом Overpass (кеш tools/city-data/.osm-cache/<slug>-water.json):
контуры водоёмов и береговая линия, а также оси рек и каналов — у русла без площади в OSM берег
нарисован лентой вокруг оси.
"""

from typing import Any

import numpy as np
from shapely import STRtree

from build_water import RIVER_RIBBON_M, SIMPLIFY_M
from geodata.checks.city import City
from geodata.checks.measure import distances, rings_of, tree_of
from geodata.checks.report import Report
from geodata.osm import cached, overpass
from geodata.paths import CACHE

# Берег в water.geojson отходит от берега OSM на допуск упрощения и округление координат.
SHORE_M = SIMPLIFY_M + 0.5
# Берега «у районов» — ближе этого к району (м); дальние, за городом, на карте не видны.
SHORE_NEAR_M = 5.0
SHORE_SHARE = 0.99
QUERY_MARGIN_DEG = 0.01
AXIS_KINDS = ('river', 'canal', 'stream')

WATER_QUERY = (
    '(way["natural"~"^(water|coastline)$"]({box});way["waterway"~"^(riverbank|dock)$"]({box});'
    'way["landuse"~"^(reservoir|basin)$"]({box});relation["natural"="water"]({box});'
    'relation["waterway"="riverbank"]({box});relation["landuse"~"^(reservoir|basin)$"]({box});'
    ')->.a;(way.a;way(r.a);way["waterway"~"^(river|canal|stream)$"]({box}););out tags geom;'
)


def osm_water(city: City) -> dict[str, Any]:
    west, south, east, north = city.info['bbox']
    margin = QUERY_MARGIN_DEG
    box = f'{south - margin},{west - margin},{north + margin},{east + margin}'
    return cached(
        CACHE / f'{city.slug}-water.json',
        lambda: overpass('[out:json][timeout:300];' + WATER_QUERY.format(box=box)),
    )


def check_water(city: City, report: Report) -> None:
    tree = STRtree(city.water_parts)
    pairs = zip(*tree.query(city.districts, predicate='intersects'), strict=True)
    report.add_overlap(
        'W1',
        'наложение районов на воду',
        [
            city.districts[district].intersection(city.water_parts[water])
            for district, water in pairs
        ],
    )

    shores: list[np.ndarray] = []
    axes: list[np.ndarray] = []
    for tags, line in city.ways(osm_water(city)):
        (axes if tags.get('waterway') in AXIS_KINDS else shores).append(line)

    # Вершины воды у районов: дальние берега (за городом) на карте не видны.
    rings = [np.asarray(ring.coords) for part in city.water_parts for ring in rings_of(part)]
    vertices = np.concatenate([ring[:-1] for ring in rings])
    district_rings = [
        np.asarray(ring.coords) for district in city.districts for ring in rings_of(district)
    ]
    vertices = vertices[distances(tree_of(district_rings), vertices) <= SHORE_NEAR_M]

    on_shore = distances(tree_of(shores), vertices) <= SHORE_M
    on_ribbon = np.abs(distances(tree_of(axes), vertices) - RIVER_RIBBON_M) <= SHORE_M
    share = float((on_shore | on_ribbon).mean()) if len(vertices) else 1.0
    ribbon_share = float((~on_shore & on_ribbon).mean())
    report.add(
        'W1',
        f'берега у районов на берегах OSM ({len(vertices)} вершин воды)',
        f'{share:.2%} (из них лента вдоль оси русла {ribbon_share:.2%})',
        f'≥ {SHORE_SHARE:.0%} не дальше {SHORE_M:g} м',
        share >= SHORE_SHARE,
    )
