"""Районы города из OpenStreetMap -> districts.geojson, city.json и журнал чистки.

Санкт-Петербург, Кёльн и Бристоль — официальное деление: район = отношение OSM целиком, вершины
OSM без упрощения и сглаживания (geodata/districts/official.py). В Костанае официальных районов
в OSM нет: линии OSM режут город на кварталы, и каждый квартал целиком отходит району, который
занимал его раньше (geodata/districts/blocks.py, затравка — --seed или текущий districts.geojson).
Из районов вырезается вода (water.geojson города, её собирает build_water.py).

Дальше районы чистятся (tidy.py; все правки — в district_edits.geojson), их общие границы сводятся
к одним вершинам, щепки отбрасываются, районы раскрашиваются. Настройки городов — в cities.py.

Названия районов берутся из текущего districts.geojson, у нового города — из тегов OSM. Пишет
backend/data/cities/<slug>/ и копию для демо-режима фронтенда. Нужны shapely и Pillow
(tools/city-data/requirements.txt).

Запуск из корня репозитория:

    python tools/city-data/build_districts.py cologne
    python tools/city-data/build_districts.py kostanay --preview preview.png

После районов пересобираются дороги и плитки: build_streets.py, затем build_map_tiles.py.
"""

import argparse
import math
from collections import defaultdict
from pathlib import Path

from shapely.ops import unary_union

from cities import CITIES
from geodata.districts.blocks import block_districts
from geodata.districts.finish import clean, colorize, renode
from geodata.districts.official import official_districts
from geodata.districts.preview import draw_preview
from geodata.districts.properties import known_properties, osm_properties
from geodata.districts.tidy import tidy
from geodata.geometry import area_m2
from geodata.output import (
    copy_to_demo,
    feature_collection,
    polygon_coordinates,
    read_json,
    write_json,
)
from geodata.paths import DATA, EDITS_FILE

COORD_DIGITS = 7  # как в OSM: вершины районов — узлы OSM


def district_feature(properties: dict, geometry) -> dict:
    coordinates = [polygon_coordinates(part, COORD_DIGITS) for part in geometry.geoms]
    return {
        'type': 'Feature',
        'properties': properties,
        'geometry': {'type': 'MultiPolygon', 'coordinates': coordinates},
    }


def edit_feature(edit: dict) -> dict:
    return {
        'type': 'Feature',
        'properties': {'kind': edit['kind'], 'district': edit['district']},
        'geometry': {
            'type': 'Polygon',
            'coordinates': polygon_coordinates(edit['geometry'], COORD_DIGITS),
        },
    }


def with_frame(city: dict, districts: dict, note: str) -> dict:
    """city.json с центром и рамкой по районам (рамка округлена наружу до 5 знаков)
    и описанием источника районов."""
    union = unary_union(list(districts.values()))
    west, south, east, north = union.bounds
    city['center'] = [round(union.centroid.x, 5), round(union.centroid.y, 5)]
    city['bbox'] = [
        math.floor(west * 1e5) / 1e5,
        math.floor(south * 1e5) / 1e5,
        math.ceil(east * 1e5) / 1e5,
        math.ceil(north * 1e5) / 1e5,
    ]
    city['note'] = note
    return city


def print_districts(districts: dict, before: dict, lat0: float) -> None:
    print(f'{"район":28}{"исходно, км²":>14}{"стало, км²":>12}{"кусков":>8}{"вершин":>9}')
    for district, geometry in districts.items():
        rings = [ring for part in geometry.geoms for ring in (part.exterior, *part.interiors)]
        vertices = sum(len(ring.coords) for ring in rings)
        was = area_m2(before[district], lat0) / 1e6
        now = area_m2(geometry, lat0) / 1e6
        print(f'{district:28}{was:14.2f}{now:12.2f}{len(geometry.geoms):8}{vertices:9}')


def print_edits(edits: list[dict], lat0: float) -> None:
    hectares: dict[str, float] = defaultdict(float)
    for edit in edits:
        hectares[edit['kind']] += area_m2(edit['geometry'], lat0) / 1e4
    print('чистка, га: ' + ', '.join(f'{kind} {area:.1f}' for kind, area in hectares.items()))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('city', choices=sorted(CITIES), help='slug города')
    parser.add_argument('--seed', type=Path, help='прежние районы Костаная (по умолчанию текущие)')
    parser.add_argument('--preview', type=Path, help='сохранить картинку для сверки (PNG)')
    args = parser.parse_args()

    slug = args.city
    config = CITIES[slug]
    folder = DATA / slug
    city = read_json(folder / 'city.json')
    lat0 = city['center'][1]
    properties = known_properties(folder)

    if 'blocks' in config:
        seed = args.seed or folder / 'districts.geojson'
        raw, before, water = block_districts(slug, config, folder, seed, lat0)
    else:
        raw, before, water = official_districts(slug, config, folder, lat0)
        for district, osm in osm_properties(slug, config).items():
            properties.setdefault(district, osm)

    marked = config.get('bumps', ())
    districts, edits = tidy(dict(clean(raw, lat0)), water, lat0, config.get('bump_m', 0), marked)
    districts = clean(renode(districts, water), lat0)
    empty = [district for district, geometry in districts.items() if geometry.is_empty]
    if empty:
        raise SystemExit(f'{slug}: у районов нет территории: {empty}')
    palette = colorize(districts, {s: p['palette'] for s, p in properties.items()})

    features = [
        district_feature({**properties[district], 'palette': palette[district]}, geometry)
        for district, geometry in districts.items()
    ]
    size = write_json(folder / 'districts.geojson', feature_collection(features))
    write_json(folder / 'city.json', with_frame(city, districts, config['note']))
    write_json(folder / EDITS_FILE, feature_collection([edit_feature(edit) for edit in edits]))
    copy_to_demo(slug)

    print_districts(districts, before, lat0)
    print_edits(edits, lat0)
    print(f'{slug}: {len(features)} районов, {size // 1024} КБ, центр {city["center"]}')
    if args.preview:
        seeds = before if 'blocks' in config else None
        draw_preview(args.preview, districts, palette, water, seeds, lat0)
    print(f'Дальше: python tools/city-data/build_streets.py {slug}, затем build_map_tiles.py')


if __name__ == '__main__':
    main()
