// Контуры районов обведены по растру 10 м (ARCHITECTURE.md 5.1) и сохраняют «ступеньки» по 20 м,
// которые на 3D-плитах выглядят зубчатыми краями. Здесь они сглаживаются без щелей между соседями:
// каждая граница режется на дуги между узлами (точками, где меняется набор районов по обе стороны);
// каждая дуга сглаживается один раз — Дуглас–Пекер убирает ступеньки, срезание углов Чайкина
// скругляет остальное — и оба района получают ровно одну и ту же дугу.

const METERS_PER_DEGREE = 111_320;

const keyOf = ([lon, lat]) => `${lon.toFixed(7)},${lat.toFixed(7)}`;
const edgeKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

function douglasPeucker(points, tolerance, toMeters) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    const [ax, ay] = toMeters(points[first]);
    const [bx, by] = toMeters(points[last]);
    const dx = bx - ax;
    const dy = by - ay;
    const length = Math.hypot(dx, dy);
    let farthest = -1;
    let distance = tolerance;
    for (let i = first + 1; i < last; i++) {
      const [px, py] = toMeters(points[i]);
      const d = length
        ? Math.abs(dy * px - dx * py + bx * ay - by * ax) / length
        : Math.hypot(px - ax, py - ay);
      if (d > distance) {
        distance = d;
        farthest = i;
      }
    }
    if (farthest !== -1) {
      keep[farthest] = 1;
      stack.push([first, farthest], [farthest, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

// Срезание углов с закреплёнными концами (концы общие с другими дугами).
function chaikin(points, iterations) {
  let result = points;
  for (let n = 0; n < iterations && result.length > 2; n++) {
    const next = [result[0]];
    for (let i = 0; i < result.length - 1; i++) {
      const [ax, ay] = result[i];
      const [bx, by] = result[i + 1];
      if (i > 0) next.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25]);
      if (i < result.length - 2) next.push([ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
    }
    next.push(result.at(-1));
    result = next;
  }
  return result;
}

export function smoothBoundaries(collection, { tolerance = 16, iterations = 2 } = {}) {
  const rings = [];
  collection.features.forEach((feature, f) =>
    feature.geometry.coordinates.forEach((polygon, p) =>
      polygon.forEach((ring, r) => rings.push({ f, p, r, points: ring.slice(0, -1) })),
    ),
  );
  if (!rings.length) return collection;

  const lat = rings[0].points[0][1];
  const kx = METERS_PER_DEGREE * Math.cos((lat * Math.PI) / 180);
  const toMeters = ([lon, la]) => [lon * kx, la * METERS_PER_DEGREE];

  // Какие кольца используют каждое ребро — граница двух районов используется обоими.
  const edgeRings = new Map();
  rings.forEach((ring, index) => {
    ring.keys = ring.points.map(keyOf);
    ring.keys.forEach((key, i) => {
      const edge = edgeKey(key, ring.keys[(i + 1) % ring.keys.length]);
      if (!edgeRings.has(edge)) edgeRings.set(edge, new Set());
      edgeRings.get(edge).add(index);
    });
  });
  const sideOf = (ring, i) => {
    const n = ring.keys.length;
    const edge = edgeKey(ring.keys[(i + n) % n], ring.keys[(i + 1 + n) % n]);
    return [...edgeRings.get(edge)].sort().join(',');
  };

  const arcs = new Map(); // каноническая дуга → сглаженные точки в каноническом порядке
  const smoothArc = (points, keys) => {
    const forward = keys.join(';');
    const backward = [...keys].reverse().join(';');
    const reversed = backward < forward;
    const canonical = reversed ? backward : forward;
    if (!arcs.has(canonical)) {
      const ordered = reversed ? [...points].reverse() : points;
      arcs.set(canonical, chaikin(douglasPeucker(ordered, tolerance, toMeters), iterations));
    }
    const smooth = arcs.get(canonical);
    return reversed ? [...smooth].reverse() : smooth;
  };

  const smoothed = rings.map((ring) => {
    const n = ring.keys.length;
    let nodes = [];
    for (let i = 0; i < n; i++) if (sideOf(ring, i - 1) !== sideOf(ring, i)) nodes.push(i);
    // Кольцо с одним соседом по всему контуру (или без соседей): начинаем с его наименьшей вершины
    // — той же точки для обоих колец, которые её делят.
    if (!nodes.length) {
      nodes = [ring.keys.reduce((best, key, i) => (key < ring.keys[best] ? i : best), 0)];
    }
    const out = [];
    nodes.forEach((start, j) => {
      const end = nodes[(j + 1) % nodes.length];
      const span = (end - start + n) % n || n;
      const indices = Array.from({ length: span + 1 }, (_, k) => (start + k) % n);
      const arc = smoothArc(
        indices.map((i) => ring.points[i]),
        indices.map((i) => ring.keys[i]),
      );
      out.push(...arc.slice(0, -1));
    });
    out.push(out[0]);
    return out;
  });

  return {
    ...collection,
    features: collection.features.map((feature, f) => ({
      ...feature,
      geometry: {
        ...feature.geometry,
        coordinates: feature.geometry.coordinates.map((polygon, p) =>
          polygon.map((_, r) => {
            const index = rings.findIndex((ring) => ring.f === f && ring.p === p && ring.r === r);
            return smoothed[index];
          }),
        ),
      },
    })),
  };
}
