"""Где лежат данные. Пути считаются от корня репозитория: скрипты работают из любой папки."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]

DATA = ROOT / 'backend' / 'data' / 'cities'  # данные городов: backend/data/cities/<slug>/
DEMO = ROOT / 'frontend' / 'src' / 'demo-data' / 'cities'  # их копия для демо-режима фронтенда
MAPS = ROOT / 'frontend' / 'public' / 'maps'  # плитки подложки карты
CACHE = ROOT / 'backend' / '.osm-cache'  # сырые ответы Overpass (в git не попадают)

# Журнал чистки контуров: что убрано у районов и что добавлено (geodata/districts/tidy.py).
EDITS_FILE = 'district_edits.geojson'
