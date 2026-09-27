import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { gsap } from '@/shared/animations/gsapSetup';
import { cssVar } from '@/shared/lib/cssVar';
import { labelPoint } from '@/shared/lib/geoProjection';
import { colorForAggregate, colorForDistrict, colorForNoData, colorForScore } from './moodColor';

const LIFT = 0.14;
const HOVER_DURATION = 0.45;
const EDGE_OPACITY = 0.85;

// Выдавленные плиты районов. Три режима цвета: 'districts' — у каждого района свой пастельный цвет
// (легко различать), 'mood' — цвет по общему настроению жителей, 'scores' — любая метрика дашборда
// города на шкале настроения (setScores). Светлые границы между районами читаются как улицы и
// разделяют соседей похожего цвета. Используется полной картой и сценой главной. Координаты слоя: x
// — восток, y — вверх, z — юг (1 единица = 1 км до масштаба родителя).
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
      streetOpacity = 0.28,
    } = {},
  ) {
    this.group = new THREE.Group();
    this.items = new Map();
    this.meshes = [];
    this.lineMaterials = [];
    this.baseHeight = baseHeight;
    this.heightRange = heightRange;
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
    if (streets) this.addStreets(streets.features, project, streetOpacity);
  }

  // Настоящие улицы (OSM) поверх каждой плиты, чтобы районы читались как город, а не плоские блоки.
  addStreets(features, project, opacity) {
    this.streetMaterial = new THREE.LineBasicMaterial({
      color: new THREE.Color(cssVar('--scene-street-on-district')),
      transparent: true,
      opacity,
    });
    const bySlug = new Map();
    features.forEach(({ properties, geometry }) => {
      if (!this.items.has(properties.district)) return;
      const list = bySlug.get(properties.district) ?? [];
      const pts = geometry.coordinates.map(project);
      for (let i = 0; i < pts.length - 1; i++) {
        list.push(pts[i][0], 1.004, -pts[i][1], pts[i + 1][0], 1.004, -pts[i + 1][1]);
      }
      bySlug.set(properties.district, list);
    });
    bySlug.forEach((positions, slug) => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      this.items.get(slug).group.add(new THREE.LineSegments(geometry, this.streetMaterial));
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
      height: this.baseHeight,
      // Площадь (км²): при столкновении подписей большие районы сохраняют свою.
      area: shapes.reduce(
        (sum, shape) => sum + Math.abs(THREE.ShapeUtils.area(shape.getPoints())),
        0,
      ),
    });
    item.scale.y = this.baseHeight;
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
  }

  setScores(scores) {
    this.scores = scores ?? {};
    if (this.colorMode === 'scores') this.applyColors(0.7);
  }

  // Агрегаты настроения задают высоту плит (активность), а в режиме 'mood' — и цвет.
  setData(aggregates, { animate = true } = {}) {
    this.aggregates = aggregates;
    const maxSample = Math.max(1, ...Object.values(aggregates).map((a) => a.sample_size ?? 0));
    const duration = animate ? 0.9 : 0;
    this.items.forEach((item) => {
      const aggregate = aggregates[item.slug];
      const activity = aggregate?.insufficient_data
        ? 0
        : Math.sqrt((aggregate?.sample_size ?? 0) / maxSample);
      item.height = this.baseHeight + this.heightRange * activity;
      if (this.introDone) {
        gsap.to(item.group.scale, { y: item.height, duration, ease: 'power3.out' });
      }
    });
    this.applyColors(duration);
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
    this.streetMaterial?.dispose();
    this.group.removeFromParent();
  }
}
