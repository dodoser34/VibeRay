"""Общий код скриптов геоданных (tools/city-data/build_*.py и verify_city_data.py).

paths.py      где лежат данные городов, копии для фронтенда, плитки и кеш OSM
osm.py        запросы к Overpass API, кеш ответов, разбор путей и отношений OSM
geometry.py   градусы ↔ метры, площади, разбор мультиполигонов на куски
roads.py      какие пути OSM — дороги и каким классом они рисуются
output.py     запись JSON в стиле Prettier, координаты GeoJSON, копии для демо-режима
districts/    части сборки районов (build_districts.py)
checks/       проверки готовых данных (verify_city_data.py)
"""
