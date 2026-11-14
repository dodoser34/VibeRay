"""Чистка контуров: то, что на карте выглядит мусором, хотя формально верно.

По порядку:

1. Клочки на чужом берегу — отдельный кусок района за рекой, который касается земли вне города.
2. Тонкие полосы (пирс, кромка берега, лента вдоль дороги): внутри чужого района — ему, иначе
   убираются. У города из кварталов так же убираются широкие выступы в пустую землю (bump_m)
   и выступы, отмеченные пользователем точкой (bumps).
3. Суша, запертая между районами и водой (пляж, намыв за официальной линией), — соседнему району.
4. Узкие щели в городе (длинный вырез официальной границы) — району с самой длинной границей.

Каждая правка записывается в журнал (district_edits.geojson): проверка данных не считает ошибкой
границу, которая прошла не по линии OSM там, где её поправила чистка. Измерения — в метрах, правки
применяются к районам в градусах на сетке координат OSM.
"""

import math

import shapely
from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union

from geodata.districts.faces import GRID
from geodata.geometry import Projection, parts

FRAME_M = 3_000  # вокруг города: «земля вне города» для клочков и запертой суши
FAR_BANK_M2 = 100_000  # клочок района меньше этого на чужом берегу (касается земли вне города)
FAR_BANK_SHARE = 0.2  # …не меньше чем такой долей своей границы (остров с дамбой — не берег)
THIN_M = 12  # полоса уже двух таких радиусов (пирс, кромка берега, лента вдоль дороги) — тонкая
THIN_MIN_M2 = 300
THIN_MIN_PERIMETER_M = 150
MOVE_SHARE = 0.5  # полоса, которая на столько свободной границы касается соседа, отходит ему
WATER_SHARE = 0.3  # широкий выступ, который касается воды меньше этого, — выступ в пустую землю
MARKED_BUMP_M = 130  # выступ, отмеченный точкой: всё, что уже двух таких радиусов
MARKED_REACH_M = 50  # дальше от точки выступа нет: его уже убрала прошлая сборка
FILL_MAX_M2 = 1_000_000  # суша, запертая между районами и водой, меньше этого отходит району
SLIT_M = 60  # щель в городе уже двух таких радиусов заполняется
SLIT_MIN_M2 = 5_000
SLIT_RATIO = 3  # щель: площадь больше стольких квадратов её ширины
MIN_CONTACT_M = 10  # заливку получает сосед, который касается куска хотя бы на столько
PATCH_M = 0.02  # правка чуть шире куска: на сетке координат не остаётся волосяных щепок


def tidy(
    districts: dict, water, lat0: float, bump_m: float = 0, marked: tuple = ()
) -> tuple[dict, list[dict]]:
    """Почищенные районы и журнал правок: [{kind, district, geometry (полигон в градусах)}]."""
    cleanup = Cleanup(districts, water, lat0)
    cleanup.remove_far_banks()
    for radius in filter(None, (THIN_M, bump_m)):
        cleanup.remove_thin(radius)
    for lon, lat in marked:
        cleanup.cut_marked_bump(lon, lat)
    gone = unary_union(cleanup.removed) if cleanup.removed else Polygon()
    cleanup.fill_trapped_land(gone)
    cleanup.fill_slits(gone)
    return cleanup.districts, cleanup.edits


def opened(geometry, radius: float):
    """Геометрия без всего, что уже двух радиусов (морфологическое открытие)."""
    shrunk = geometry.buffer(-radius, join_style='mitre')
    return shrunk.buffer(radius * 1.05, join_style='mitre')


def solid(geometry):
    """Только полигоны: после вычитания на сетке остаются линии и точки."""
    return unary_union(parts(geometry))


def contact(piece, other) -> float:
    """Длина общей границы (м): площадь метровой каймы куска внутри соседа."""
    return piece.buffer(1.0).intersection(other).area


def strip_width(piece) -> float:
    """Ширина прямоугольника с той же площадью и периметром."""
    return (piece.length - math.sqrt(max(piece.length**2 - 16 * piece.area, 0))) / 4


class Cleanup:
    """Районы в градусах (districts) и их копия в метрах (shapes), которые правятся вместе."""

    def __init__(self, districts: dict, water, lat0: float) -> None:
        self.projection = Projection(lat0)
        self.districts = districts
        self.water = water
        self.shapes = {slug: self.meters(geometry) for slug, geometry in districts.items()}
        self.wet = self.meters(water)
        self.edits: list[dict] = []
        self.removed: list = []
        self.frame = box(*self.city().bounds).buffer(FRAME_M)

    def meters(self, geometry):
        return self.projection.to_meters(geometry)

    def degrees(self, geometry):
        return shapely.set_precision(self.projection.to_degrees(geometry), GRID)

    def city(self):
        return unary_union(list(self.shapes.values()))

    def apply(self, kind: str, slug: str, piece, target: str | None = None) -> None:
        """Убрать кусок у района slug и отдать его району target. Без target кусок только
        убирается, без slug — только добавляется району target."""
        patch = solid(self.degrees(piece.buffer(PATCH_M)))
        if slug:
            remaining = shapely.difference(self.districts[slug], patch, grid_size=GRID)
            self.set_district(slug, solid(remaining))
        if target:
            gain = patch
            for other, geometry in self.districts.items():
                if other != target:
                    gain = solid(shapely.difference(gain, geometry, grid_size=GRID))
            gain = solid(shapely.difference(gain, self.water, grid_size=GRID))
            joined = shapely.union(self.districts[target], gain, grid_size=GRID)
            self.set_district(target, solid(joined))
        else:
            self.removed.append(piece)
        for part in parts(self.degrees(piece)):
            self.edits.append({'kind': kind, 'district': target or slug, 'geometry': part})

    def set_district(self, slug: str, geometry) -> None:
        self.districts[slug] = geometry
        self.shapes[slug] = self.meters(geometry)

    def best_neighbour(self, piece, exclude: str | None = None) -> tuple[str, float]:
        """Район с самой длинной общей границей с куском и длина этой границы."""
        around = {o: contact(piece, g) for o, g in self.shapes.items() if o != exclude}
        best = max(around, key=around.get)
        return best, around[best]

    def remove_far_banks(self) -> None:
        """Отдельный кусок суши города, который касается земли вне города, — чужой берег."""
        outside = self.frame.difference(self.city()).difference(self.wet.buffer(0.05))
        masses = parts(self.city().buffer(0.01))
        largest = max(masses, key=lambda mass: mass.area)
        for mass in masses:
            if mass is largest or mass.area >= FAR_BANK_M2:
                continue
            if contact(mass, outside) < FAR_BANK_SHARE * mass.length:
                continue
            for slug in list(self.shapes):
                piece = self.shapes[slug].intersection(mass)
                if piece.area > 1:
                    self.apply('far_bank', slug, piece)

    def remove_thin(self, radius: float) -> None:
        """Полосы уже двух радиусов: внутри чужого района — ему, у воды и на краю — убрать.
        Широкий выступ (radius = bump_m) убирается, только если торчит в пустую землю, а не
        в воду."""
        for slug in list(self.shapes):
            thin = self.shapes[slug].difference(opened(self.shapes[slug], radius))
            for piece in parts(thin):
                if piece.area < THIN_MIN_M2 * (radius / THIN_M) ** 2:
                    continue
                if piece.length < THIN_MIN_PERIMETER_M:
                    continue
                best, touching = self.best_neighbour(piece, exclude=slug)
                free = piece.length - contact(piece, self.shapes[slug].difference(piece))
                if touching >= MOVE_SHARE * free:
                    self.apply('move', slug, piece, best)
                elif radius == THIN_M or contact(piece, self.wet) < WATER_SHARE * free:
                    self.apply('cut', slug, piece)

    def cut_marked_bump(self, lon: float, lat: float) -> None:
        """Выступ, отмеченный пользователем точкой внутри, отсекается по самому узкому месту."""
        spot = Point(lon * self.projection.kx, lat * self.projection.ky)
        slug = min(self.shapes, key=lambda item: self.shapes[item].distance(spot))
        shape = self.shapes[slug]
        lumps = parts(shape.difference(opened(shape, MARKED_BUMP_M)))
        lump = min(lumps, key=lambda item: item.distance(spot), default=None)
        if lump is not None and lump.distance(spot) <= MARKED_REACH_M:
            self.apply('cut', slug, lump)

    def fill_trapped_land(self, gone) -> None:
        """Суша, запертая между районами и водой, — району с самой длинной общей границей.
        Место, откуда чистка только что убрала кусок (gone), обратно не заполняется."""
        inner_frame = self.frame.buffer(-1)
        outside = self.frame.difference(self.city()).difference(self.wet)
        for piece in parts(outside):
            if piece.area > FILL_MAX_M2 or piece.area < 1 or not piece.within(inner_frame):
                continue
            if piece.intersection(gone).area > 0.5 * piece.area:
                continue
            best, touching = self.best_neighbour(piece)
            if touching >= MIN_CONTACT_M:
                self.apply('fill', '', piece, best)

    def fill_slits(self, gone) -> None:
        """Узкие длинные щели между районами — району с самой длинной общей границей."""
        filled = unary_union([self.city(), self.wet])
        closed = filled.buffer(SLIT_M, join_style='mitre').buffer(-SLIT_M, join_style='mitre')
        for piece in parts(closed.difference(filled.buffer(0.05))):
            if piece.area < SLIT_MIN_M2 or piece.area < SLIT_RATIO * strip_width(piece) ** 2:
                continue
            if piece.intersection(gone).area > 0.5 * piece.area:
                continue
            best, touching = self.best_neighbour(piece)
            if touching >= MIN_CONTACT_M:
                self.apply('slit', '', piece, best)
