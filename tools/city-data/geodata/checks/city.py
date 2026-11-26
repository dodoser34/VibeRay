"""Готовые данные города для проверок — в метрах вокруг его центра (x — восток, y — север)."""

from collections import defaultdict
from typing import Any

import numpy as np
import shapely
from shapely.geometry import shape
from shapely.geometry.base import BaseGeometry

from cities import CITIES
from geodata.geometry import parts, scale
from geodata.output import read_json
from geodata.paths import DATA, EDITS_FILE

# Виды правок чистки контуров (geodata/districts/tidy.py): кусок района убран, добавлен из пустой
# земли или отдан соседу. На месте правки граница района не обязана лежать на линии OSM.
REMOVED_EDITS = ('far_bank', 'cut')
ADDED_EDITS = ('fill', 'slit')
ALL_EDITS = (*REMOVED_EDITS, *ADDED_EDITS, 'move')


class City:
    """Районы, вода и журнал правок города, переведённые в метры."""

    def __init__(self, slug: str) -> None:
        self.slug = slug
        self.config = CITIES[slug]
        self.folder = DATA / slug
        self.info = read_json(self.folder / 'city.json')
        self.lat0 = self.info['center'][1]
        self.kx, self.ky = scale(self.lat0)

        self.collection = read_json(self.folder / 'districts.geojson')
        features = self.collection['features']
        self.slugs = [feature['properties']['slug'] for feature in features]
        self.expected = list(self.config.get('districts') or self.config['blocks'])
        self.raw = [shape(feature['geometry']) for feature in features]
        self.districts = [self.metric(geometry) for geometry in self.raw]
        self.union = shapely.union_all(self.districts)

        water = read_json(self.folder / 'water.geojson')
        self.water_parts = [
            self.metric(shapely.make_valid(shape(feature['geometry'])))
            for feature in water['features']
        ]
        self.water = shapely.union_all(
            [polygon for geometry in self.water_parts for polygon in parts(geometry)]
        )
        self.edits = self.load_edits()

    @property
    def is_official(self) -> bool:
        """Районы — официальное деление OSM (а не кварталы по затравке)."""
        return 'districts' in self.config

    def metric(self, geometry: BaseGeometry) -> BaseGeometry:
        return shapely.transform(geometry, lambda coords: coords * [self.kx, self.ky])

    def xy(self, lon_lat: np.ndarray) -> np.ndarray:
        return np.asarray(lon_lat, dtype=float) * [self.kx, self.ky]

    def load_edits(self) -> dict[str, list[BaseGeometry]]:
        """Правки чистки контуров: вид правки → полигоны в метрах.

        Файла журнала нет — значит, правок не было.
        """
        path = self.folder / EDITS_FILE
        edits: dict[str, list[BaseGeometry]] = defaultdict(list)
        if path.exists():
            for feature in read_json(path)['features']:
                kind = feature['properties']['kind']
                edits[kind].append(self.metric(shape(feature['geometry'])))
        return edits

    def edited(self, kinds: tuple[str, ...], margin_m: float) -> BaseGeometry:
        """Места правок этих видов с запасом (пустой полигон, если правок нет)."""
        pieces = [piece for kind in kinds for piece in self.edits.get(kind, [])]
        if not pieces:
            return shapely.Polygon()
        return shapely.buffer(shapely.union_all(pieces), margin_m)

    def ways(self, osm: dict[str, Any]) -> list[tuple[dict[str, str], np.ndarray]]:
        """Пути ответа Overpass: (теги, вершины в метрах)."""
        result: list[tuple[dict[str, str], np.ndarray]] = []
        for element in osm['elements']:
            geometry = element.get('geometry')
            if element['type'] == 'way' and geometry and len(geometry) > 1:
                lon_lat = np.array([(node['lon'], node['lat']) for node in geometry])
                result.append((element.get('tags', {}), self.xy(lon_lat)))
        return result
