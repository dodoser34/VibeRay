import { createProjection } from './geoProjection';

export const OUTLINE_SIDES = 72; // гладкость контура: касательная через каждые 5°
const MARGIN_SHARE = 0.06; // запас вокруг районов — доля размаха города
const MIN_MARGIN_KM = 0.6;

// Контур города — гладкая выпуклая «петля» вокруг всех районов на расстоянии запаса: многоугольник
// из OUTLINE_SIDES касательных к районам, отодвинутых на margin. edges — стороны в км сцены,
// [nx, ny, h]: точка p внутри, если nx·px + ny·py ≤ h, а h − n·p — расстояние до стороны (для плавного
// затухания подложки у края, fade — ширина полосы затухания: внутри неё районов нет). Тот же контур
// у плиток карты (backend/scripts/build_map_tiles.py): за ним плиток нет. reach — самая дальняя от
// центра точка контура (для волны проявления дорог в истории).
export function cityOutline(districts, center) {
  const project = createProjection(center);
  const points = districts.features.flatMap(({ geometry }) =>
    geometry.coordinates.flatMap(([outer]) => outer.map(project)),
  );
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
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
    edges.reduce((max, [, , h]) => Math.max(max, h), 0) / Math.cos(Math.PI / OUTLINE_SIDES);
  return { edges, fade: margin, reach };
}
