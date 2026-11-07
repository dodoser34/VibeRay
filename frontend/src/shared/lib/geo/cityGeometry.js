import * as THREE from 'three';
import { createProjection, createUnprojection, labelPoint, ringArea } from './geoProjection';
import { smoothBoundaries } from './smoothBoundaries';

// Тяжёлая подготовка районов города — один раз при загрузке, в фоновом потоке (cityGeometry.worker.js):
// сглаживание границ (smoothBoundaries), треугольники плит (выдавливание на высоту 1, плита потом
// масштабируется по высоте) в км проекции вокруг центра города, точка подписи ([lon, lat]: её можно
// спроецировать в любом масштабе) и площадь (км²). На главном потоке у большого города это почти
// секунда.
export function buildCityGeometry({ districts, water, center }) {
  const smoothed = smoothBoundaries(districts, { water });
  const project = createProjection(center);
  const unproject = createUnprojection(center);
  const plates = {};
  smoothed.features.forEach(({ properties: { slug }, geometry }) => {
    const polygons = geometry.coordinates.map((polygon) =>
      polygon.map((ring) => ring.map(project)),
    );
    const shapes = polygons.map(([outer, ...holes]) => {
      const shape = new THREE.Shape(outer.map(([x, y]) => new THREE.Vector2(x, y)));
      holes.forEach((hole) =>
        shape.holes.push(new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x, y)))),
      );
      return shape;
    });
    const plate = new THREE.ExtrudeGeometry(shapes, { depth: 1, bevelEnabled: false });
    plate.rotateX(-Math.PI / 2);
    plates[slug] = {
      position: plate.attributes.position.array,
      normal: plate.attributes.normal.array,
      uv: plate.attributes.uv.array,
      label: unproject(labelPoint(polygons)),
      area: polygons.reduce(
        (sum, [outer, ...holes]) =>
          sum + ringArea(outer) - holes.reduce((h, hole) => h + ringArea(hole), 0),
        0,
      ),
    };
    plate.dispose();
  });
  return { districts: smoothed, plates };
}

// Массивы плит — передаются из воркера без копирования.
export const plateBuffers = (plates) =>
  Object.values(plates).flatMap(({ position, normal, uv }) => [
    position.buffer,
    normal.buffer,
    uv.buffer,
  ]);
