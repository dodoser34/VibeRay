import * as THREE from 'three';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { renderQuality } from '@/adaptations/core';
import { getMapTiles, getMapVector } from '@/shared/api/endpoints/cities';
import { cssVar } from '@/shared/lib/theme/cssVar';
import { injectEdgeFade } from './edgeFade';

const VECTOR_Y = 0.006; // чуть выше плиток
const UPDATE_MS = 120;
const MAX_LOADING = 6;
const BUILDS_PER_FRAME = 2; // кусков, превращаемых в геометрию за кадр
const STALE_MS = 1500;
const CACHE = { mobile: 24, tablet: 36, desktop: 48 };
// Линии включаются там, где самый детальный уровень плиток (RASTER_MPP м на пиксель) растянут на
// экране сильнее, чем в DETAIL_SLACK раз, и плавно проявляются в полосе FADE_BAND.
const RASTER_MPP = 3;
const DETAIL_SLACK = 1.5;
const FADE_BAND = 1.3;
// Классы дорог — как в build_map_tiles.py: ширина на земле (м), цвет, прозрачность. Тогда переход от
// плитки к линиям незаметен.
const ROADS = [
  { kind: 'service', width: 3, color: '--scene-road', opacity: 0.6 },
  { kind: 'local', width: 5, color: '--scene-road', opacity: 0.95 },
  { kind: 'rail', width: 5, color: '--scene-road-major', opacity: 0.85 },
  { kind: 'tertiary', width: 9, color: '--scene-road-major', opacity: 0.75 },
  { kind: 'secondary', width: 11, color: '--scene-road-major', opacity: 0.9 },
  { kind: 'major', width: 14, color: '--scene-road-major', opacity: 1 },
];
// Точка отрезка в км сцены (x — восток, y — север) для затухания у края города.
const LINE_POINT = '(position.y < 0.5 ? instanceStart : instanceEnd).xz * vec2(1.0, -1.0)';

// Дороги карты вблизи (уровень улицы) — чёткие линии из векторных кусков (клетки самого детального
// уровня плиток, build_map_tiles.py). Кусок грузится, только если клетка в кадре и камера к ней близко;
// ближние — первыми. Толщина — в метрах на земле (worldUnits), как в плитках. mixAt(x, y) — насколько
// линии клетки уже видны: плитка под ними гасит свои дороги (MapTiles.roadMix).
export class MapVectors {
  constructor(slug, outline) {
    this.slug = slug;
    this.outline = outline;
    this.group = new THREE.Group();
    this.chunks = new Map(); // "x/y" → { x, y, used, distance, data, mesh, materials, mix }
    this.queue = [];
    this.builds = [];
    this.loading = 0;
    this.lastUpdate = -Infinity;
    this.limit = CACHE[renderQuality().tier] ?? CACHE.desktop;
    this.resolution = new THREE.Vector2(1, 1);
    this.ready = getMapTiles(slug).then((manifest) => {
      if (this.disposed) return;
      this.cellKm = manifest.vectorCellKm;
      this.unitKm = manifest.vectorUnitM / 1000;
      this.cells = manifest.vector;
    });
  }

  setResolution(width, height) {
    this.resolution.set(width, height);
    this.chunks.forEach((chunk) =>
      chunk.materials?.forEach((m) => m.resolution.set(width, height)),
    );
  }

  setTheme() {
    this.chunks.forEach((chunk) =>
      chunk.materials?.forEach((material, i) => material.color.set(cssVar(ROADS[i].color))),
    );
  }

  mixAt(x, y) {
    return this.chunks.get(`${x}/${y}`)?.mix ?? 0;
  }

  // Каждый кадр из MapScene: готовые куски становятся геометрией, выбор кусков — не чаще UPDATE_MS.
  // true — вид изменился (нужен кадр).
  update(camera, viewportHeight, time) {
    let changed = this.flushBuilds();
    if (!this.cells || time - this.lastUpdate < UPDATE_MS) return changed;
    this.lastUpdate = time;
    camera.updateMatrixWorld();
    const frustum = new THREE.Frustum().setFromProjectionMatrix(
      new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
    );
    const metersPerPixelAtKm =
      (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * 1000) / viewportHeight;
    const near = RASTER_MPP / (DETAIL_SLACK * metersPerPixelAtKm); // км: ближе — линии полностью
    const far = near * FADE_BAND;
    const box = new THREE.Box3();
    const wanted = new Map();
    this.cells.forEach(([x, y]) => {
      box.min.set(x * this.cellKm, 0, -(y + 1) * this.cellKm);
      box.max.set((x + 1) * this.cellKm, 0.01, -y * this.cellKm);
      const distance = box.distanceToPoint(camera.position);
      if (distance >= far || !frustum.intersectsBox(box)) return;
      wanted.set(`${x}/${y}`, 1 - THREE.MathUtils.smoothstep(distance, near, far));
      this.request(x, y, time, distance);
    });
    this.chunks.forEach((chunk, key) => {
      const mix = chunk.mesh ? (wanted.get(key) ?? 0) : 0;
      if (mix !== chunk.mix) changed = true;
      chunk.mix = mix;
      if (!chunk.mesh) return;
      chunk.mesh.visible = mix > 0;
      chunk.materials.forEach((material, i) => (material.opacity = ROADS[i].opacity * mix));
    });
    this.evict(time);
    this.pump(time);
    return changed;
  }

  request(x, y, time, distance) {
    const key = `${x}/${y}`;
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = { x, y, used: time, distance, mix: 0 };
      this.chunks.set(key, chunk);
      this.queue.push(chunk);
    }
    chunk.used = time;
    chunk.distance = distance;
    return chunk;
  }

  // Загрузка — не больше MAX_LOADING кусков разом, ближние к камере первыми; уже ненужные — из очереди.
  pump(time) {
    this.queue = this.queue.filter((chunk) => {
      const stale = time - chunk.used > STALE_MS;
      if (stale) this.chunks.delete(`${chunk.x}/${chunk.y}`);
      return !stale;
    });
    this.queue.sort((a, b) => a.distance - b.distance);
    while (this.loading < MAX_LOADING && this.queue.length) {
      const chunk = this.queue.shift();
      this.loading += 1;
      getMapVector(this.slug, chunk.x, chunk.y).then(
        (data) => {
          this.loading -= 1;
          if (!this.disposed && this.chunks.get(`${chunk.x}/${chunk.y}`) === chunk) {
            this.builds.push([chunk, data]);
          }
        },
        () => {
          this.loading -= 1;
          this.chunks.delete(`${chunk.x}/${chunk.y}`);
        },
      );
    }
  }

  flushBuilds() {
    let count = 0;
    while (count < BUILDS_PER_FRAME && this.builds.length) {
      const [chunk, data] = this.builds.shift();
      if (this.disposed || this.chunks.get(`${chunk.x}/${chunk.y}`) !== chunk) continue;
      this.build(chunk, data);
      count += 1;
    }
    if (count) this.lastUpdate = -Infinity; // новые линии — сразу пересчитать проявление
    return count > 0;
  }

  // Кусок → по линии LineSegments2 на класс (отрезки в км сцены: x — восток, z — юг).
  build(chunk, data) {
    const ox = chunk.x * this.cellKm;
    const oy = chunk.y * this.cellKm;
    const unit = this.unitKm;
    const mesh = new THREE.Group();
    chunk.materials = ROADS.map((style, order) => {
      const material = new LineMaterial({
        color: cssVar(style.color),
        linewidth: style.width / 1000,
        worldUnits: true,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      material.resolution.copy(this.resolution);
      material.customProgramCacheKey = () => 'map-vector';
      material.onBeforeCompile = (shader) => injectEdgeFade(shader, this.outline, LINE_POINT);
      const lines = data[style.kind];
      if (!lines) return material;
      const segments = lines.reduce((sum, line) => sum + line.length / 2 - 1, 0);
      const positions = new Float32Array(segments * 6);
      let k = 0;
      lines.forEach((line) => {
        for (let i = 0; i + 3 < line.length; i += 2) {
          positions.set(
            [
              ox + line[i] * unit,
              VECTOR_Y,
              -(oy + line[i + 1] * unit),
              ox + line[i + 2] * unit,
              VECTOR_Y,
              -(oy + line[i + 3] * unit),
            ],
            k,
          );
          k += 6;
        }
      });
      const geometry = new LineSegmentsGeometry();
      geometry.setPositions(positions);
      const object = new LineSegments2(geometry, material);
      object.renderOrder = order;
      mesh.add(object);
      return material;
    });
    mesh.visible = false;
    chunk.mesh = mesh;
    this.group.add(mesh);
  }

  evict(time) {
    const built = [...this.chunks.values()].filter((chunk) => chunk.mesh);
    const extra = built.length - this.limit;
    if (extra <= 0) return;
    built
      .filter((chunk) => chunk.used < time)
      .sort((a, b) => a.used - b.used)
      .slice(0, extra)
      .forEach((chunk) => this.release(chunk));
  }

  release(chunk) {
    chunk.mesh.traverse((object) => object.geometry?.dispose());
    chunk.materials.forEach((material) => material.dispose());
    chunk.mesh.removeFromParent();
    this.chunks.delete(`${chunk.x}/${chunk.y}`);
  }

  dispose() {
    this.disposed = true;
    this.chunks.forEach((chunk) => chunk.mesh && this.release(chunk));
    this.builds = [];
    this.group.removeFromParent();
  }
}
