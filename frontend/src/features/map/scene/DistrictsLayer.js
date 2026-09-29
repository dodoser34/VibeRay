import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { gsap } from '@/shared/animations/gsapSetup';
import { cssVar } from '@/shared/lib/cssVar';
import { labelPoint, pointInPolygon } from '@/shared/lib/geoProjection';
import { createRandom, hashString } from '@/shared/lib/random';
import { colorForAggregate, colorForDistrict, colorForNoData, colorForScore } from './moodColor';
import { ROAD_CLASSES, roadLines, segmentsByKind } from './roadStyles';

const LIFT = 0.14;
const HOVER_DURATION = 0.45;
const EDGE_OPACITY = 0.85;
const WINDOW_SIZE = 0.03; // км: крошечный квадрат света на крыше
const WINDOWS_PER_KM2 = 30;
const MAX_WINDOWS = 160;
const WINDOW_OPACITY = 0.78;

// Выдавленные плиты районов. Три режима цвета: 'districts' — у каждого района свой пастельный цвет
// (легко различать), 'mood' — цвет по общему настроению жителей, 'scores' — любая метрика дашборда
// города на шкале настроения (setScores). Светлые границы между районами читаются как улицы и
// разделяют соседей похожего цвета. Используется полной картой и сценой главной. Координаты слоя: x
// — восток, y — вверх, z — юг (1 единица = 1 км до масштаба родителя).
// Высота плиты — то же значение, что и цвет: настроение района (или метрика дашборда) на шкале
// −2…+2, чем лучше — тем выше; heightScale — множитель высоты (0 — плоская карта). Районы, где
// отметок мало, остаются низкими.
export class DistrictsLayer {
  constructor(
    features,
    project,
    {
      baseHeight = 0.2,
      heightRange = 0.45,
      lineWidth = 2,
      opacity = 0.92,
      roughness = 0.7,
      colorMode = 'districts',
      streets = null,
      streetOpacity = 1,
      streetKinds = null,
    } = {},
  ) {
    this.group = new THREE.Group();
    this.items = new Map();
    this.meshes = [];
    this.lineMaterials = [];
    this.baseHeight = baseHeight;
    this.heightRange = heightRange;
    this.heightScale = 1;
    this.baseOpacity = opacity;
    this.roughness = roughness;
    this.colorMode = colorMode;
    this.aggregates = {};
    this.scores = {};
    this.hovered = null;
    this.selected = null;
    this.dimmed = false;
    this.introDone = false;

    features.forEach((feature) => this.addDistrict(feature, project, lineWidth));
    this.streetMaterials = [];
    if (streets) this.addStreets(streets.features, project, streetOpacity, streetKinds);
  }

  // Настоящие улицы (OSM) поверх каждой плиты, чтобы районы читались как город, а не плоские блоки:
  // тёмные линии по иерархии дорог (магистрали толще и заметнее, дворовые проезды — едва видны).
  // opacity — общий множитель (на главной улицы тише), kinds — какие классы рисовать (null — все).
  // Линии лежат на верхней грани плиты (y ≈ 1) и растут вместе с ней; у объектов userData.street —
  // история на «О проекте» прорисовывает их по прогрессу.
  addStreets(features, project, opacity, kinds) {
    const color = new THREE.Color(cssVar('--scene-street-on-district'));
    const bySlug = new Map();
    features.forEach((feature) => {
      const { district, kind } = feature.properties;
      if (!this.items.has(district) || (kinds && !kinds.includes(kind))) return;
      bySlug.set(district, [...(bySlug.get(district) ?? []), feature]);
    });
    bySlug.forEach((list, slug) => {
      const byKind = segmentsByKind(list, project, 0);
      ROAD_CLASSES.forEach((style, i) => {
        const positions = byKind.get(style.kind);
        if (!positions?.length) return;
        const { object, material, fat } = roadLines(positions, style, {
          color,
          opacity: style.slab * opacity,
        });
        object.position.y = 1.004 + i * 0.0005;
        object.userData.street = true;
        if (fat) this.lineMaterials.push(material);
        this.streetMaterials.push(material);
        this.items.get(slug).group.add(object);
      });
    });
  }

  addDistrict(feature, project, lineWidth) {
    const { slug, name, palette } = feature.properties;
    const polygons = feature.geometry.coordinates.map((polygon) =>
      polygon.map((ring) => ring.map(project)),
    );
    const shapes = polygons.map(([outer, ...holes]) => {
      const shape = new THREE.Shape(outer.map(([x, y]) => new THREE.Vector2(x, y)));
      holes.forEach((hole) =>
        shape.holes.push(new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x, y)))),
      );
      return shape;
    });

    const geometry = new THREE.ExtrudeGeometry(shapes, { depth: 1, bevelEnabled: false });
    geometry.rotateX(-Math.PI / 2);

    const color = colorForDistrict(palette);
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.08,
      transparent: true,
      opacity: this.baseOpacity,
      roughness: this.roughness,
      metalness: 0,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData = { kind: 'district', slug };

    const lineMaterial = new LineMaterial({
      color: new THREE.Color(cssVar('--scene-district-edge')),
      linewidth: lineWidth,
      transparent: true,
      opacity: EDGE_OPACITY,
    });
    this.lineMaterials.push(lineMaterial);

    const item = new THREE.Group();
    item.add(mesh);
    polygons.forEach(([outer]) => {
      const positions = outer.flatMap(([x, y]) => [x, 1.002, -y]);
      const lineGeometry = new LineGeometry();
      lineGeometry.setPositions(positions);
      item.add(new Line2(lineGeometry, lineMaterial));
    });
    this.group.add(item);
    this.meshes.push(mesh);

    const [lx, ly] = labelPoint(polygons);
    this.items.set(slug, {
      slug,
      name,
      palette,
      group: item,
      material,
      lineMaterial,
      anchor: new THREE.Vector2(lx, -ly),
      polygons,
      height: this.baseHeight,
      // Площадь (км²): при столкновении подписей большие районы сохраняют свою.
      area: shapes.reduce(
        (sum, shape) => sum + Math.abs(THREE.ShapeUtils.area(shape.getPoints())),
        0,
      ),
    });
    item.scale.y = this.baseHeight;
  }

  // Окна на крышах: загораются вечером и ночью (setWindows). В районах побольше — больше окон;
  // detail (renderQuality) уменьшает их число на слабых устройствах. Квадраты лежат плашмя на верхней
  // грани плиты, поэтому вместе с ней растут по высоте.
  addWindows({ detail = 1 } = {}) {
    this.windowMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(cssVar('--scene-window')),
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const geometry = new THREE.PlaneGeometry(WINDOW_SIZE, WINDOW_SIZE);
    geometry.rotateX(-Math.PI / 2);
    const dummy = new THREE.Object3D();
    this.items.forEach((item) => {
      const count = Math.min(MAX_WINDOWS, Math.round(item.area * WINDOWS_PER_KM2 * detail));
      if (!count) return;
      const rand = createRandom(hashString(`windows:${item.slug}`));
      const rings = item.polygons;
      const xs = rings.flatMap(([outer]) => outer.map((p) => p[0]));
      const ys = rings.flatMap(([outer]) => outer.map((p) => p[1]));
      const [minX, maxX, minY, maxY] = [
        Math.min(...xs),
        Math.max(...xs),
        Math.min(...ys),
        Math.max(...ys),
      ];
      const inside = (point) => rings.some((polygon) => pointInPolygon(point, polygon));
      const mesh = new THREE.InstancedMesh(geometry, this.windowMaterial, count);
      let placed = 0;
      for (let attempt = 0; placed < count && attempt < count * 12; attempt++) {
        const point = [minX + rand() * (maxX - minX), minY + rand() * (maxY - minY)];
        if (!inside(point)) continue;
        dummy.position.set(point[0], 1.007, -point[1]);
        dummy.updateMatrix();
        mesh.setMatrixAt(placed, dummy.matrix);
        placed += 1;
      }
      mesh.count = placed;
      mesh.userData.lit = new Uint8Array(placed).fill(1);
      item.windows = mesh;
      item.group.add(mesh);
    });
    this.windowGeometry = geometry;
  }

  setWindows(level, duration = 1.5) {
    if (!this.windowMaterial) return;
    gsap.to(this.windowMaterial, {
      opacity: level * WINDOW_OPACITY,
      duration,
      ease: 'power2.inOut',
      overwrite: 'auto',
    });
  }

  // Живой город: время от времени в паре случайных окон гаснет или загорается свет.
  twinkle(rand = Math.random) {
    if (!this.windowMaterial || this.windowMaterial.opacity < 0.05) return;
    const items = [...this.items.values()].filter((item) => item.windows);
    const dummy = new THREE.Object3D();
    for (let n = 0; n < 3; n++) {
      const mesh = items[Math.floor(rand() * items.length)]?.windows;
      if (!mesh) continue;
      const i = Math.floor(rand() * mesh.count);
      mesh.getMatrixAt(i, dummy.matrix);
      dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
      mesh.userData.lit[i] ^= 1;
      dummy.scale.setScalar(mesh.userData.lit[i] ? 1 : 0.001);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  setResolution(width, height) {
    this.lineMaterials.forEach((material) => material.resolution.set(width, height));
  }

  colorOf(item) {
    if (this.colorMode === 'mood') return colorForAggregate(this.aggregates[item.slug]);
    if (this.colorMode === 'scores') {
      const score = this.scores[item.slug];
      return score === null || score === undefined ? colorForNoData() : colorForScore(score);
    }
    return colorForDistrict(item.palette);
  }

  // Новая смена цвета заменяет идущую (overwrite): например, настроения приходят чуть раньше оценок
  // дашборда, и более длинная первая анимация не должна закончиться последней.
  applyColors(duration) {
    this.items.forEach((item) => {
      const { r, g, b } = this.colorOf(item);
      gsap.to(item.material.color, { r, g, b, duration, overwrite: 'auto' });
      gsap.to(item.material.emissive, { r, g, b, duration, overwrite: 'auto' });
    });
  }

  setColorMode(mode) {
    if (mode === this.colorMode) return;
    this.colorMode = mode;
    this.applyColors(0.7);
    this.updateHeights(0.9);
  }

  setScores(scores) {
    this.scores = scores ?? {};
    if (this.colorMode === 'scores') {
      this.applyColors(0.7);
      this.updateHeights(0.9);
    }
  }

  setHeightScale(scale) {
    this.heightScale = scale;
    this.updateHeights(0.7);
  }

  // Агрегаты настроения задают высоту плит, а в режиме 'mood' — и цвет.
  setData(aggregates, { animate = true } = {}) {
    this.aggregates = aggregates;
    const duration = animate ? 0.9 : 0;
    this.updateHeights(duration);
    this.applyColors(duration);
  }

  // Значение района на шкале −2…+2: метрика дашборда или настроение; null — мало отметок.
  scoreOf(slug) {
    if (this.colorMode === 'scores') return this.scores[slug] ?? null;
    const aggregate = this.aggregates[slug];
    return aggregate && !aggregate.insufficient_data ? aggregate.score : null;
  }

  updateHeights(duration) {
    this.items.forEach((item) => {
      const score = this.scoreOf(item.slug);
      const level = score === null ? 0 : (Math.max(-2, Math.min(2, score)) + 2) / 4;
      item.height = this.baseHeight + this.heightRange * this.heightScale * level;
      if (this.introDone) {
        gsap.to(item.group.scale, { y: item.height, duration, ease: 'power3.out' });
      }
    });
  }

  animateIn({ delay = 0, stagger = 0.09 } = {}) {
    const items = [...this.items.values()].sort((a, b) => a.anchor.length() - b.anchor.length());
    items.forEach((item) => {
      item.group.scale.y = 0.001;
      item.material.opacity = 0;
    });
    const timeline = gsap.timeline({
      delay,
      onComplete: () => {
        this.introDone = true;
        // Настроения могут прийти во время появления — остаёмся на последних высотах.
        this.items.forEach((item) => gsap.to(item.group.scale, { y: item.height, duration: 0.6 }));
      },
    });
    items.forEach((item, i) => {
      timeline.to(
        item.group.scale,
        { y: item.height, duration: 1.1, ease: 'back.out(1.5)' },
        i * stagger,
      );
      timeline.to(item.material, { opacity: this.baseOpacity, duration: 0.6 }, i * stagger);
    });
    return timeline;
  }

  setHovered(slug) {
    if (slug === this.hovered) return;
    this.hovered = slug;
    this.refreshStates();
  }

  setSelected(slug) {
    this.selected = slug;
    this.refreshStates();
  }

  setDimmed(dimmed) {
    if (dimmed === this.dimmed) return;
    this.dimmed = dimmed;
    this.refreshStates();
  }

  refreshStates() {
    const focus = this.hovered ?? this.selected;
    this.items.forEach((item) => {
      const active = item.slug === this.hovered || item.slug === this.selected;
      const faded = this.dimmed || (focus && !active);
      gsap.to(item.group.position, {
        y: active ? LIFT : 0,
        duration: HOVER_DURATION,
        ease: 'power3.out',
      });
      gsap.to(item.material, {
        opacity: faded ? this.baseOpacity * 0.45 : this.baseOpacity,
        emissiveIntensity: active ? 0.22 : faded ? 0.02 : 0.08,
        duration: HOVER_DURATION,
      });
      gsap.to(item.lineMaterial, {
        opacity: faded ? 0.3 : EDGE_OPACITY,
        duration: HOVER_DURATION,
      });
    });
  }

  flash(slug) {
    const item = this.items.get(slug);
    if (!item) return null;
    return gsap
      .timeline()
      .to(item.material, { emissiveIntensity: 0.5, duration: 0.18, ease: 'power2.out' })
      .to(item.group.scale, { y: item.height * 1.9, duration: 0.25, ease: 'power2.out' }, 0)
      .to(item.material, { emissiveIntensity: 0.22, duration: 1.2, ease: 'power2.inOut' })
      .to(item.group.scale, { y: item.height, duration: 0.9, ease: 'elastic.out(1, 0.45)' }, '<');
  }

  // Верх-центр района в мировых координатах (для подписей, меток и перелётов камеры).
  getAnchor(slug, target = new THREE.Vector3()) {
    const item = this.items.get(slug);
    if (!item) return null;
    target.set(item.anchor.x, item.height + item.group.position.y, item.anchor.y);
    return this.group.localToWorld(target);
  }

  getLocalAnchor(slug) {
    const item = this.items.get(slug);
    return item ? new THREE.Vector3(item.anchor.x, item.height, item.anchor.y) : null;
  }

  heightOf(slug) {
    return this.items.get(slug)?.height ?? this.baseHeight;
  }

  dispose() {
    this.items.forEach((item) => {
      gsap.killTweensOf([
        item.group.scale,
        item.group.position,
        item.material,
        item.material.color,
        item.material.emissive,
        item.lineMaterial,
      ]);
      item.group.traverse((object) => object.geometry?.dispose());
      item.material.dispose();
      item.lineMaterial.dispose();
    });
    this.streetMaterials.forEach((material) => material.dispose());
    if (this.windowMaterial) gsap.killTweensOf(this.windowMaterial);
    this.windowMaterial?.dispose();
    this.windowGeometry?.dispose();
    this.group.removeFromParent();
  }
}
