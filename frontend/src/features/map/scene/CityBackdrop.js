import * as THREE from 'three';
import { cssVar } from '@/shared/lib/cssVar';

const GROUND_TEXTURE_SIZE = 512;
const RIVER_WIDTH_KM = 0.09;
const WATER_Y = 0.012;

// Окрестности города из OpenStreetMap: мягкая земля, настоящие улицы вне районов, река Тобол и
// водоёмы. Улицы внутри районов рисуются на самих плитах (DistrictsLayer), поэтому здесь берутся
// только отрезки с `district === null`.
export class CityBackdrop {
  constructor(project, { water, streets } = {}, { size = 40 } = {}) {
    this.group = new THREE.Group();
    this.project = project;

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

  toWorld([lon, lat], y) {
    const [x, north] = this.project([lon, lat]);
    return new THREE.Vector3(x, y, -north);
  }

  addStreets(features) {
    const positions = [];
    features.forEach(({ geometry }) => {
      const pts = geometry.coordinates.map((c) => this.project(c));
      for (let i = 0; i < pts.length - 1; i++) {
        positions.push(pts[i][0], 0.004, -pts[i][1], pts[i + 1][0], 0.004, -pts[i + 1][1]);
      }
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.group.add(
      new THREE.LineSegments(
        geometry,
        new THREE.LineBasicMaterial({
          color: cssVar('--color-street'),
          transparent: true,
          opacity: 0.9,
        }),
      ),
    );
  }

  addWater(features) {
    const material = new THREE.MeshStandardMaterial({
      color: cssVar('--color-river'),
      roughness: 0.45,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });

    const shapes = features
      .filter((f) => f.geometry.type === 'Polygon')
      .map(({ geometry }) => {
        const [outer] = geometry.coordinates;
        return new THREE.Shape(outer.map((c) => new THREE.Vector2(...this.project(c))));
      });
    if (shapes.length) {
      const lakes = new THREE.Mesh(new THREE.ShapeGeometry(shapes), material);
      lakes.rotation.x = -Math.PI / 2;
      lakes.position.y = WATER_Y;
      this.group.add(lakes);
    }

    // Реки: плоские ленты (сплющенная труба сверху читается как спокойная полоса воды).
    features
      .filter((f) => f.geometry.type === 'LineString' && f.geometry.coordinates.length > 1)
      .forEach(({ geometry }) => {
        const points = geometry.coordinates.map((c) => this.toWorld(c, WATER_Y));
        const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
        const ribbon = new THREE.Mesh(
          new THREE.TubeGeometry(curve, Math.max(8, points.length * 3), RIVER_WIDTH_KM / 2, 6),
          material,
        );
        ribbon.scale.y = 0.08;
        this.group.add(ribbon);
      });
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
