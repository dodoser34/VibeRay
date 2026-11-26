# Данные городов

Скрипты, которые собирают город из OpenStreetMap и проверяют результат. Подробно — в
[docs/guide/07-geodata-pipeline.md](../../docs/guide/07-geodata-pipeline.md) и в `ARCHITECTURE.md`, раздел 5.3.

```bash
pip install -r tools/city-data/requirements.txt
```

Запуск из корня репозитория, строго по порядку — каждый шаг читает результат предыдущего:

| Шаг | Команда | Что получается |
|---|---|---|
| 1 | `python tools/city-data/build_water.py <город>` | вода (нужна новому городу; у готовых уже собрана) |
| 2 | `python tools/city-data/build_districts.py <город>` | районы, центр и рамка города, список правок чистки |
| 3 | `python tools/city-data/build_streets.py <город> --save-osm tools/city-data/.osm-cache/<город>-streets.json` | схема дорог по районам и сохранённый ответ Overpass |
| 4 | `python tools/city-data/build_map_tiles.py <город>` или `--all` | плитки карты и векторные куски дорог |
| 5 | `python tools/city-data/verify_city_data.py <город>` или `--all` | таблица проверок и итог «ПРИНЯТО» |

- `cities.py` — настройки городов: какие районы и откуда они берутся в OSM, ручные правки границ.
- `geodata/` — общий код: пути, Overpass и кеш, геометрия, дороги, сборка районов (`districts/`),
  проверки (`checks/`).
- `.osm-cache/` — сырые ответы Overpass, чтобы пересобирать без сети. В git не попадает.
  Ответ с дорогами (шаг 3) сам не сохраняется — нужен `--save-osm`: по нему `geodata/checks/streets.py`
  сверяет схему с OSM, а повторная сборка дорог идёт без сети (`--osm` вместо `--save-osm`).
  Большой город грузится частями: `--tiles 4 --skip-outside service` (подробно — в начале `build_streets.py`).

Куда пишут скрипты:

- `backend/data/cities/<город>/` — исходные данные города (их будет отдавать API);
- `frontend/src/demo-data/cities/<город>/` — копия районов, `city.json` и воды для демо-режима сайта;
- `frontend/public/maps/<город>/` — плитки подложки карты.
