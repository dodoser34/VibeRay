"""Картинка для сверки районов глазами.

На ней районы своими цветами, вода и (тонкой красной линией) прежние контуры. Цвета условные:
это не карта сайта, а рабочий набросок.
"""

from collections.abc import Sequence
from pathlib import Path

from PIL import Image, ImageDraw
from shapely.geometry import MultiPolygon, box
from shapely.geometry.base import BaseGeometry
from shapely.ops import unary_union

from geodata.districts.faces import Districts
from geodata.geometry import parts, scale

Color = tuple[int, int, int]

SIZE_PX = 2400
GROUND = (236, 240, 232)
WATER = (150, 200, 235)
BORDER = (255, 255, 255)
BEFORE = (180, 30, 30)
LABEL = (20, 20, 20)
COLORS = [
    (196, 120, 96),
    (120, 160, 200),
    (150, 190, 120),
    (210, 180, 100),
    (160, 130, 190),
    (110, 180, 170),
    (200, 140, 170),
    (140, 150, 110),
    (220, 150, 90),
    (120, 140, 180),
    (180, 200, 140),
    (170, 120, 120),
]


def draw_preview(
    path: Path,
    districts: dict[str, MultiPolygon],
    palette: dict[str, int],
    water: BaseGeometry,
    before: Districts | None,
    lat0: float,
) -> None:
    west, south, east, north = unary_union(list(districts.values())).buffer(0.01).bounds
    kx, ky = scale(lat0)
    pixels_per_m = SIZE_PX / max((east - west) * kx, (north - south) * ky)

    def px(point: Sequence[float]) -> tuple[float, float]:
        return ((point[0] - west) * kx * pixels_per_m, (north - point[1]) * ky * pixels_per_m)

    width = round((east - west) * kx * pixels_per_m)
    height = round((north - south) * ky * pixels_per_m)
    image = Image.new('RGB', (width, height), GROUND)
    draw = ImageDraw.Draw(image)

    def fill(geometry: BaseGeometry, color: Color, outline: Color | None = None) -> None:
        # Каждый кусок — своим слоем: дыра (озеро, остров в воде) не закрашивает то, что под ней.
        for part in parts(geometry):
            mask = Image.new('L', image.size, 0)
            pen = ImageDraw.Draw(mask)
            pen.polygon([px(point) for point in part.exterior.coords], fill=255)
            for hole in part.interiors:
                pen.polygon([px(point) for point in hole.coords], fill=0)
            image.paste(color, mask=mask)
            if outline:
                for ring in (part.exterior, *part.interiors):
                    draw.line([px(point) for point in ring.coords], fill=outline, width=1)

    for slug, geometry in districts.items():
        fill(geometry, COLORS[palette[slug] - 1], BORDER)
    fill(water.intersection(box(west, south, east, north)), WATER)
    for geometry in (before or {}).values():
        for part in parts(geometry):
            draw.line([px(point) for point in part.exterior.coords], fill=BEFORE, width=1)
    for slug, geometry in districts.items():
        if not geometry.is_empty:
            draw.text(px(geometry.geoms[0].representative_point().coords[0]), slug, fill=LABEL)
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path)
