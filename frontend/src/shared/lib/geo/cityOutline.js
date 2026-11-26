import { createProjection } from './geoProjection';

export const OUTLINE_SIDES = 72; // гладкость контура: касательная через каждые 5°
const MARGIN_SHARE = 0.06; // запас вокруг районов — доля размаха города
const MIN_MARGIN_KM = 0.6;

// Контур города — выпуклый многоугольник из OUTLINE_SIDES касательных к районам, отодвинутых на
// запас. Тот же контур у плиток карты (tools/city-data/build_map_tiles.py): за ним плиток нет.
// edges — стороны в км сцены, [nx, ny, h]: точка p внутри, если nx·px + ny·py ≤ h, а h − n·p —
// расстояние до стороны (по нему подложка гаснет у края). fade — ширина полосы затухания (в ней
// районов нет), reach — расстояние до самой дальней точки контура (для волны проявления дорог
// в истории).
export function cityOutline(districts, center) {
  const project = createProjection(center);
  const points = districts.features.flatMap(({ geometry }) =>
    geometry.coordinates.flatMap(([outer]) => outer.map(project)),
  );
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const margin = Math.max(MIN_MARGIN_KM, span * MARGIN_SHARE);

  const edges = Array.from({ length: OUTLINE_SIDES }, (_, k) => {
    const angle = (2 * Math.PI * k) / OUTLINE_SIDES;
    const nx = Math.cos(angle);
    const ny = Math.sin(angle);
    const reach = points.reduce((max, [x, y]) => Math.max(max, nx * x + ny * y), -Infinity);
    return [nx, ny, reach + margin];
  });
  const reach =
    edges.reduce((max, [, , distance]) => Math.max(max, distance), 0) /
    Math.cos(Math.PI / OUTLINE_SIDES);
  return { edges, fade: margin, reach };
}
