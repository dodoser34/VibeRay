"""Готовые данные города для проверок — в метрах вокруг его центра (x — восток, y — север)."""

from collections import defaultdict

import numpy as np
import shapely
from shapely.geometry import shape

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
    def __init__(self, slug: str) -> None:
        self.slug = slug
        self.config = CITIES[slug]
        self.folder = DATA / slug
        self.info = read_json(self.folder / 'city.json')
        self.lat0 = self.info['center'][1]
        self.kx, self.ky = scale(self.lat0)

        self.collection = read_json(self.folder / 'districts.geojson')
        self.slugs = [f['properties']['slug'] for f in self.collection['features']]
        self.expected = list(self.config.get('districts') or self.config['blocks'])
        self.raw = [shape(f['geometry']) for f in self.collection['features']]
        self.districts = [self.metric(g) for g in self.raw]
        self.union = shapely.union_all(self.districts)

        water = read_json(self.folder / 'water.geojson')
        self.water_parts = [
            self.metric(shapely.make_valid(shape(f['geometry']))) for f in water['features']
        ]
        self.water = shapely.union_all([p for g in self.water_parts for p in parts(g)])
        self.edits = self.load_edits()

    @property
    def is_official(self) -> bool:
        """Районы — официальное деление OSM (а не кварталы по затравке)."""
        return 'districts' in self.config

    def metric(self, geometry):
        return shapely.transform(geometry, lambda c: c * [self.kx, self.ky])

    def xy(self, lon_lat: np.ndarray) -> np.ndarray:
        return np.asarray(lon_lat, dtype=float) * [self.kx, self.ky]

    def load_edits(self) -> dict[str, list]:
        """Правки чистки контуров: вид правки → полигоны в метрах. Файла нет — правок не было."""
        path = self.folder / EDITS_FILE
        edits: dict[str, list] = defaultdict(list)
        if path.exists():
            for feature in read_json(path)['features']:
                kind = feature['properties']['kind']
                edits[kind].append(self.metric(shape(feature['geometry'])))
        return edits

    def edited(self, kinds: tuple[str, ...], margin_m: float):
        """Места правок этих видов с запасом (пустой полигон, если правок нет)."""
        pieces = [piece for kind in kinds for piece in self.edits.get(kind, [])]
        if not pieces:
            return shapely.Polygon()
        return shapely.buffer(shapely.union_all(pieces), margin_m)

    def ways(self, osm: dict) -> list[tuple[dict, np.ndarray]]:
        """Пути ответа Overpass: (теги, вершины в метрах)."""
        result = []
        for element in osm['elements']:
            geometry = element.get('geometry')
            if element['type'] == 'way' and geometry and len(geometry) > 1:
                lon_lat = np.array([(node['lon'], node['lat']) for node in geometry])
                result.append((element.get('tags', {}), self.xy(lon_lat)))
        return result
