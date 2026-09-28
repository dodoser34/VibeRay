import * as THREE from 'three';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { rootScale } from '@/adaptations/core';
import { cssVar } from '@/shared/lib/cssVar';

// Иерархия дорог схемы (классы — из streets.geojson, по тегам OSM highway/railway), от дворовых
// проездов к магистралям: каждый следующий рисуется поверх предыдущего. width — толщина в px экрана
// (0 — тонкая линия в 1 px); ground — цвет и прозрачность на земле; slab — прозрачность тёмной линии
// на крыше района. Названий и адресов на схеме нет — только рисунок дорог.
export const ROAD_CLASSES = [
  { kind: 'service', width: 0, ground: ['--scene-road-service', 0.6], slab: 0.12 },
  { kind: 'local', width: 0, ground: ['--scene-road', 0.95], slab: 0.26 },
  { kind: 'tertiary', width: 1.4, ground: ['--scene-road-major', 0.75], slab: 0.34 },
  { kind: 'secondary', width: 1.9, ground: ['--scene-road-major', 0.9], slab: 0.42 },
  { kind: 'major', width: 2.6, ground: ['--scene-road-major', 1], slab: 0.5 },
  { kind: 'rail', width: 1.3, ground: ['--scene-rail', 0.85], slab: 0.45, dashed: true },
];

const DASH_KM = 0.05;
const GAP_KM = 0.035;

// Отрезки дорог по классам: kind → плоский массив пар точек [x, y, z, x, y, z, …].
export function segmentsByKind(features, project, height) {
  const byKind = new Map();
  features.forEach(({ properties, geometry }) => {
    const list = byKind.get(properties.kind) ?? [];
    const points = geometry.coordinates.map(project);
    for (let i = 0; i < points.length - 1; i++) {
      const [ax, ay] = points[i];
      const [bx, by] = points[i + 1];
      list.push(ax, height, -ay, bx, height, -by);
    }
    byKind.set(properties.kind, list);
  });
  return byKind;
}

// Линии одного класса одним объектом: тонкие — LineSegments, толстые и пунктир — LineSegments2
// (толщина в пикселях экрана, растёт с масштабом интерфейса на 2K/4K). Материалу LineSegments2
// нужен размер экрана — setResolution у слоя.
export function roadLines(positions, style, { color, opacity }) {
  if (!style.width) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
    });
    return { object: new THREE.LineSegments(geometry, material), material, fat: false };
  }
  const geometry = new LineSegmentsGeometry();
  geometry.setPositions(positions);
  const material = new LineMaterial({
    color,
    linewidth: style.width * rootScale(),
    transparent: true,
    opacity,
    depthWrite: false,
    dashed: Boolean(style.dashed),
    dashSize: DASH_KM,
    gapSize: GAP_KM,
  });
  const object = new LineSegments2(geometry, material);
  if (style.dashed) object.computeLineDistances();
  return { object, material, fat: true };
}

export const groundColor = (style) => new THREE.Color(cssVar(style.ground[0]));
