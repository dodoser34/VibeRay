import * as THREE from 'three';
import { cssVar } from '@/shared/lib/cssVar';
import { groundColor, ROAD_CLASSES, roadLines, segmentsByKind } from './roadStyles';

const GROUND_TEXTURE_SIZE = 512;
const WATER_Y = 0.002; // ниже дорог: мосты через Тобол рисуются поверх воды
const ROAD_Y = 0.004;
const ROAD_STEP = 0.0006; // классы поважнее — чуть выше, чтобы ложиться поверх

// Окрестности города из OpenStreetMap — плоская схема без адресов: мягкая земля, дороги вне районов
// по иерархии (магистрали толще, дворовые проезды тоньше и бледнее, железная дорога пунктиром), река
// Тобол и водоёмы по настоящим берегам (с островами). Улицы внутри районов рисуются на самих плитах (DistrictsLayer), поэтому здесь
// берутся только отрезки с `district === null`.
export class CityBackdrop {
  constructor(project, { water, streets } = {}, { size = 40 } = {}) {
    this.group = new THREE.Group();
    this.project = project;
    this.lineMaterials = [];

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshBasicMaterial({
        map: createGroundTexture(),
        transparent: true,
        depthWrite: false,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    this.group.add(ground);

    if (streets) this.addStreets(streets.features.filter((f) => !f.properties.district));
    if (water) this.addWater(water.features);
  }

  addStreets(features) {
    const byKind = segmentsByKind(features, this.project, 0);
    ROAD_CLASSES.forEach((style, i) => {
      const positions = byKind.get(style.kind);
      if (!positions?.length) return;
      const { object, material, fat } = roadLines(positions, style, {
        color: groundColor(style),
        opacity: style.ground[1],
      });
      object.position.y = ROAD_Y + i * ROAD_STEP;
      object.renderOrder = i;
      if (fat) this.lineMaterials.push(material);
      this.group.add(object);
    });
  }

  // Толстым линиям нужен размер экрана (LineMaterial считает толщину в пикселях).
  setResolution(width, height) {
    this.lineMaterials.forEach((material) => material.resolution.set(width, height));
  }

  addWater(features) {
    const material = new THREE.MeshStandardMaterial({
      color: cssVar('--color-river'),
      roughness: 0.45,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });
    const toVector = (c) => new THREE.Vector2(...this.project(c));
    const shapes = features
      .filter((f) => f.geometry.type === 'Polygon')
      .map(({ geometry }) => {
        const [outer, ...islands] = geometry.coordinates;
        const shape = new THREE.Shape(outer.map(toVector));
        islands.forEach((ring) => shape.holes.push(new THREE.Path(ring.map(toVector))));
        return shape;
      });
    if (!shapes.length) return;
    const water = new THREE.Mesh(new THREE.ShapeGeometry(shapes), material);
    water.rotation.x = -Math.PI / 2;
    water.position.y = WATER_Y;
    this.group.add(water);
  }

  dispose() {
    this.group.traverse((object) => {
      object.geometry?.dispose();
      object.material?.map?.dispose();
      object.material?.dispose();
    });
    this.group.removeFromParent();
  }
}

// Мягко освещённая земля, которая у краёв уходит в туман.
function createGroundTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = GROUND_TEXTURE_SIZE;
  const ctx = canvas.getContext('2d');
  const c = GROUND_TEXTURE_SIZE / 2;
  const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
  gradient.addColorStop(0, cssVar('--scene-ground'));
  gradient.addColorStop(0.6, cssVar('--scene-ground'));
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, GROUND_TEXTURE_SIZE, GROUND_TEXTURE_SIZE);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
