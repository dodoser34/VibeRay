"""Свойства районов в districts.geojson: slug, названия на четырёх языках и номер цвета.

Названия пишет человек, поэтому сборка их не перезаписывает: берёт из текущего districts.geojson.
У нового города файла ещё нет — названия берутся из тегов OSM, их потом проверяют и дописывают
руками.
"""

from pathlib import Path
from typing import Any

from cities import CityConfig
from geodata.osm import find_relations, official_boundaries
from geodata.output import read_json


def known_properties(folder: Path) -> dict[str, dict[str, Any]]:
    """Свойства районов из текущего districts.geojson (пусто, если файла ещё нет)."""
    path = folder / 'districts.geojson'
    if not path.exists():
        return {}
    features = read_json(path)['features']
    return {feature['properties']['slug']: feature['properties'] for feature in features}


def osm_properties(slug: str, config: CityConfig) -> dict[str, dict[str, Any]]:
    """Свойства районов из тегов OSM: name:ru, name:en, name:kk, name:de.

    Если русского названия в OSM нет, остаётся местное (name) — его заменяют транслитерацией
    вручную. Казахское и немецкое пишутся, только если они есть в OSM: без них сайт покажет
    русское и английское. Цвет (palette) назначит раскраска.
    """
    relations = find_relations(official_boundaries(slug, config['query']), config['districts'])
    result: dict[str, dict[str, Any]] = {}
    for district, name in config['districts'].items():
        tags = relations[district]['tags']
        properties: dict[str, Any] = {
            'slug': district,
            'name': tags.get('name:ru', name),
            'name_en': tags.get('name:en', name),
        }
        for language in ('kk', 'de'):
            if f'name:{language}' in tags:
                properties[f'name_{language}'] = tags[f'name:{language}']
        properties['palette'] = 0
        result[district] = properties
    return result
