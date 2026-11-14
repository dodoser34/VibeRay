"""Дороги на карте VibeRay: какие пути OSM считаются дорогой и к какому классу схемы относятся.

Классы схемы: major (магистрали), secondary, tertiary, local (улицы), service (проезды) и rail
(железная дорога). По ним рисуются плитки, режутся кварталы Костаная и проверяется схема дорог.
"""

HIGHWAY_KIND = {
    'motorway': 'major',
    'motorway_link': 'major',
    'trunk': 'major',
    'trunk_link': 'major',
    'primary': 'major',
    'primary_link': 'major',
    'secondary': 'secondary',
    'secondary_link': 'secondary',
    'tertiary': 'tertiary',
    'tertiary_link': 'tertiary',
    'unclassified': 'local',
    'residential': 'local',
    'living_street': 'local',
    'pedestrian': 'local',
    'road': 'local',
    'service': 'service',
}

# Ряды парковок — не дороги; дворовые проезды, переулки и подъезды (driveway, alley) остаются.
SKIP_SERVICE = {'parking_aisle'}


def kind_of(tags: dict) -> str | None:
    """Класс дороги по тегам пути OSM или None, если путь — не дорога."""
    if tags.get('railway') == 'rail':
        return 'rail'
    if tags.get('service') in SKIP_SERVICE or tags.get('area') == 'yes':
        return None
    return HIGHWAY_KIND.get(tags.get('highway', ''))
