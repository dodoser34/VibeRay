const METERS_PER_DEGREE = 111_320;

// Равнопромежуточная проекция вокруг центра города: для масштаба города точности хватает.
// Возвращает единицы сцены, где 1 единица = 1 км; +y — на север.
export function createProjection([centerLon, centerLat]) {
  const kx = Math.cos((centerLat * Math.PI) / 180) * METERS_PER_DEGREE;
  return ([lon, lat]) => [
    ((lon - centerLon) * kx) / 1000,
    ((lat - centerLat) * METERS_PER_DEGREE) / 1000,
  ];
}

// Обратная к createProjection: км сцены (x — восток, y — север) → [lon, lat].
export function createUnprojection([centerLon, centerLat]) {
  const kx = Math.cos((centerLat * Math.PI) / 180) * METERS_PER_DEGREE;
  return ([x, y]) => [centerLon + (x * 1000) / kx, centerLat + (y * 1000) / METERS_PER_DEGREE];
}

export function pointInRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function ringArea(ring) {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    area += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  }
  return Math.abs(area / 2);
}

export function largestRing(multiPolygon) {
  return largestPolygon(multiPolygon)[0];
}

// Самый большой полигон MultiPolygon целиком: [внешнее кольцо, ...дыры (вода)].
export function largestPolygon(multiPolygon) {
  return multiPolygon.reduce((best, polygon) =>
    ringArea(polygon[0]) > ringArea(best[0]) ? polygon : best,
  );
}

export function pointInPolygon(point, [outer, ...holes]) {
  return pointInRing(point, outer) && !holes.some((hole) => pointInRing(point, hole));
}

function distanceToSegment([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Точка глубоко внутри самого большого полигона (грубый «полюс недоступности»). В отличие от
// центроида никогда не выпадает за пределы длинных или вогнутых районов — используется для подписей
// и меток.
export function labelPoint(multiPolygon, resolution = 28) {
  const polygon = largestPolygon(multiPolygon);
  const [ring] = polygon;
  const xs = ring.map((p) => p[0]);
  const ys = ring.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const stepX = (Math.max(...xs) - minX) / resolution;
  const stepY = (Math.max(...ys) - minY) / resolution;
  let best = ring[0];
  let bestDistance = -1;
  for (let i = 0; i <= resolution; i++) {
    for (let j = 0; j <= resolution; j++) {
      const point = [minX + i * stepX, minY + j * stepY];
      if (!pointInPolygon(point, polygon)) continue;
      let distance = Infinity;
      polygon.forEach((edge) => {
        for (let k = 0; k < edge.length - 1; k++) {
          distance = Math.min(distance, distanceToSegment(point, edge[k], edge[k + 1]));
        }
      });
      if (distance > bestDistance) {
        bestDistance = distance;
        best = point;
      }
    }
  }
  return best;
}

// Площадь GeoJSON MultiPolygon в км² (внешние кольца минус дыры), в локальной проекции.
export function multiPolygonAreaKm2(coordinates, center) {
  const project = createProjection(center);
  return coordinates.reduce(
    (total, [outer, ...holes]) =>
      total +
      ringArea(outer.map(project)) -
      holes.reduce((sum, hole) => sum + ringArea(hole.map(project)), 0),
    0,
  );
}
