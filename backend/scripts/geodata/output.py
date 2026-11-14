"""Запись данных города: JSON в том же виде, что у Prettier фронтенда, и копии для демо-режима.

Файлы данных лежат и в бэкенде, и во фронтенде, поэтому пишутся так же, как их отформатировал бы
Prettier (отступ 2, ширина строки 100): пересборка даёт построчные, читаемые дифы в git.
"""

import json
import shutil
from pathlib import Path

from geodata.paths import DATA, DEMO

PRINT_WIDTH = 100  # как printWidth в frontend/.prettierrc
DEMO_FILES = ('districts.geojson', 'city.json', 'water.geojson')


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding='utf-8'))


def write_json(path: Path, value: object) -> int:
    """Записать значение в стиле Prettier. Возвращает размер файла в байтах."""
    text = pretty(value) + '\n'
    path.write_text(text, encoding='utf-8', newline='\n')
    return len(text.encode('utf-8'))


def pretty(value: object, indent: int = 0, prefix: int = 0) -> str:
    """JSON как у Prettier. prefix — сколько символов в строке перед значением (ключ)."""
    pad = '  ' * indent
    if isinstance(value, dict):
        if not value:
            return '{}'
        keys = [json.dumps(key, ensure_ascii=False) for key in value]
        items = [
            f'{key}: {pretty(item, indent + 1, len(key) + 2)}'
            for key, item in zip(keys, value.values(), strict=True)
        ]
        inline = '{ ' + ', '.join(items) + ' }'
        if '\n' not in inline and len(pad) + prefix + len(inline) + 1 <= PRINT_WIDTH:
            return inline
        return '{\n' + ',\n'.join(f'{pad}  {item}' for item in items) + f'\n{pad}}}'
    if isinstance(value, list):
        if not value:
            return '[]'
        # Список из нескольких списков или объектов (например, точек линии) Prettier всегда
        # переносит по одному на строку.
        nested = len(value) > 1 and len({type(item) for item in value}) == 1
        nested = nested and all(isinstance(item, list | dict) and len(item) > 1 for item in value)
        items = [pretty(item, indent + 1) for item in value]
        inline = '[' + ', '.join(items) + ']'
        fits = '\n' not in inline and len(pad) + prefix + len(inline) + 1 <= PRINT_WIDTH
        if fits and not nested:
            return inline
        return '[\n' + ',\n'.join(f'{pad}  {item}' for item in items) + f'\n{pad}]'
    return json.dumps(value, ensure_ascii=False)


def feature_collection(features: list[dict]) -> dict:
    return {'type': 'FeatureCollection', 'features': features}


def ring_coordinates(ring, digits: int) -> list[list[float]]:
    return [[round(x, digits), round(y, digits)] for x, y in ring.coords]


def polygon_coordinates(polygon, digits: int) -> list[list[list[float]]]:
    """Кольца полигона для GeoJSON: внешнее, затем дыры."""
    return [
        ring_coordinates(polygon.exterior, digits),
        *(ring_coordinates(hole, digits) for hole in polygon.interiors),
    ]


def copy_to_demo(slug: str, names: tuple[str, ...] = DEMO_FILES) -> None:
    """Копия файлов города для демо-режима фронтенда — побайтно та же, что в бэкенде."""
    target = DEMO / slug
    target.mkdir(parents=True, exist_ok=True)
    for name in names:
        shutil.copyfile(DATA / slug / name, target / name)
