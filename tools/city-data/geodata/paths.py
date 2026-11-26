"""Где лежат данные.

Пути считаются от корня репозитория, поэтому скрипты работают из любой папки.
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]

DATA = ROOT / 'backend' / 'data' / 'cities'
# Копия данных городов для демо-режима фронтенда.
DEMO = ROOT / 'frontend' / 'src' / 'demo-data' / 'cities'
MAPS = ROOT / 'frontend' / 'public' / 'maps'
# Сырые ответы Overpass; в git не попадают.
CACHE = ROOT / 'tools' / 'city-data' / '.osm-cache'

# Журнал чистки контуров: что убрано у районов и что добавлено (geodata/districts/tidy.py).
EDITS_FILE = 'district_edits.geojson'
