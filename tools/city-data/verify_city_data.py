"""Проверка геоданных города против сырого OpenStreetMap: районы, вода, дороги, плитки.

Сверяет готовые файлы (backend/data/cities/<slug>/, копию в демо-данных фронтенда и плитки
frontend/public/maps/<slug>/) с ответами Overpass из tools/city-data/.osm-cache/ — теми же,
по которым build_districts.py и build_streets.py (--save-osm) собирали город; если ответа
с берегами в кеше нет, он скачивается. Правки чистки контуров (district_edits.geojson) ошибкой
не считаются. Печатает таблицу «проверка — измерено — порог» и вердикт; код выхода 1, если хотя
бы одна проверка не прошла. Сами проверки — в geodata/checks/. Нужны shapely и Pillow
(tools/city-data/requirements.txt).

    D1 состав районов            D4 границы лежат на линиях OSM     R1 вершины дорог — узлы OSM
    D2 геометрия                 D5 общая граница — общие вершины   R2 дороги OSM есть на схеме
    D3 наложения и покрытие      W1 вода и районы, берега OSM       R3 дорога лежит в своём районе
    T1 плитки и векторные куски  C1 копии бэкенда и фронтенда

Запуск из корня репозитория:

    python tools/city-data/verify_city_data.py kostanay
    python tools/city-data/verify_city_data.py --all
"""

import argparse

from cities import CITIES
from geodata.checks.city import City
from geodata.checks.districts import check_districts
from geodata.checks.report import Report
from geodata.checks.streets import check_streets
from geodata.checks.tiles import check_copies, check_tiles
from geodata.checks.water import check_water


def verify(slug: str) -> Report:
    print(slug)
    city = City(slug)
    report = Report(slug)
    check_districts(city, report)
    check_water(city, report)
    streets = check_streets(city, report)
    check_tiles(city, report, streets)
    check_copies(city, report)
    print(f'  => {"ПРИНЯТО" if report.accepted else "НЕ ПРИНЯТО"}\n')
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('city', nargs='?', choices=sorted(CITIES), help='slug города')
    parser.add_argument('--all', action='store_true', help='все города')
    args = parser.parse_args()
    if not args.all and not args.city:
        parser.error('укажите город или --all')
    reports = [verify(slug) for slug in (sorted(CITIES) if args.all else [args.city])]
    accepted = all(report.accepted for report in reports)
    print('ИТОГ: ' + ('ПРИНЯТО' if accepted else 'НЕ ПРИНЯТО'))
    raise SystemExit(0 if accepted else 1)


if __name__ == '__main__':
    main()
