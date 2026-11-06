import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { gsap } from '@/shared/animations/core/gsapSetup';
import { cssVar } from '@/shared/lib/theme/cssVar';
import { labelPoint } from '@/shared/lib/geo/geoProjection';
import { colorForAggregate, colorForDistrict, colorForNoData, colorForScore } from './moodColor';

const LIFT = 0.14;
const HOVER_DURATION = 0.45;
const EDGE_OPACITY = 0.85;
const ACTIVE_BOOST = 0.35; // доля пути от baseOpacity к непрозрачной плите у района под курсором
const HIDE_DURATION = 0.8;
const FLAT = 0.001; // высота скрытой плиты: она лежит на земле и ловит клик, когда ставят метку
// Плиты прозрачнее этого — «стекло» над общим слоем дорог (MapTiles): глубину не пишут, чтобы
// дороги и стенки соседей не перекрывали друг друга, и рисуются после дорог, подкрашивая их.
const SEE_THROUGH = 0.6;
const SEE_THROUGH_ORDER = 10;

// Выдавленные плиты районов. Три режима цвета: 'districts' — у каждого района свой пастельный цвет
// (легко различать), 'mood' — цвет по общему настроению жителей, 'scores' — любая метрика дашборда
// города на шкале настроения (setScores). Светлые границы между районами читаются как улицы и
// разделяют соседей похожего цвета. Используется полной картой и сценой главной. Координаты слоя: x
// — восток, y — вверх, z — юг (1 единица = 1 км до масштаба родителя).
// Высота плиты — то же значение, что и цвет: настроение района (или метрика дашборда) на шкале
// −2…+2, чем лучше — тем выше; heightScale — множитель высоты (0 — плоская карта). Районы, где
// отметок мало, остаются низкими.
// Плиты почти прозрачные, а улицы лежат под ними на земле (MapTiles) — и на карте, и в истории
// «О проекте». setHidden убирает районы совсем — остаётся карта дорог.
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
    this.hidden = false;
    this.seeThrough = opacity < SEE_THROUGH;
    this.introDone = false;

    features.forEach((feature) => this.addDistrict(feature, project, lineWidth));
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
      depthWrite: !this.seeThrough,
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
    if (this.seeThrough) item.renderOrder = SEE_THROUGH_ORDER;
    item.add(mesh);
    polygons.forEach(([outer]) => {
      const positions = outer.flatMap(([x, y]) => [x, 1.002, -y]);
      const lineGeometry = new LineGeometry();
      lineGeometry.setPositions(positions);
      const edge = new Line2(lineGeometry, lineMaterial);
      edge.renderOrder = 1;
      item.add(edge);
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
  // Тема сменилась: границы и сами плиты — в цветах новой темы.
  refreshTheme() {
    const edge = new THREE.Color(cssVar('--scene-district-edge'));
    this.items.forEach((item) => item.lineMaterial.color.copy(edge));
    this.applyColors(0.6);
  }

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
        gsap.to(item.group.scale, { y: this.shownHeight(item), duration, ease: 'power3.out' });
      }
    });
  }

  shownHeight(item) {
    return this.hidden ? FLAT : item.height;
  }

  // Только карта дорог: плиты и границы гаснут, а плиты ложатся на землю. Высоты по-прежнему
  // считаются — при возврате районы встают на свои места.
  setHidden(hidden) {
    if (hidden === this.hidden) return;
    this.hidden = hidden;
    this.refreshStates(HIDE_DURATION);
    if (this.introDone) this.updateHeights(HIDE_DURATION);
  }

  animateIn({ delay = 0, stagger = 0.09 } = {}) {
    const items = [...this.items.values()].sort((a, b) => a.anchor.length() - b.anchor.length());
    items.forEach((item) => {
      item.group.scale.y = FLAT;
      item.material.opacity = 0;
    });
    const timeline = gsap.timeline({
      delay,
      onComplete: () => {
        this.introDone = true;
        // Настроения или скрытие районов могут прийти во время появления — остаёмся на последних
        // высотах и прозрачности.
        this.items.forEach((item) =>
          gsap.to(item.group.scale, { y: this.shownHeight(item), duration: 0.6 }),
        );
        this.refreshStates(0.6);
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

  // Новая базовая прозрачность плит (смена темы): плавно, с учётом наведения и выбора.
  setBaseOpacity(opacity) {
    if (opacity === this.baseOpacity) return;
    this.baseOpacity = opacity;
    this.refreshStates(0.6);
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

  // Прозрачность считается от baseOpacity: на полной карте и район под курсором остаётся
  // полупрозрачным — дороги под ним видны.
  refreshStates(duration = HOVER_DURATION) {
    const focus = this.hovered ?? this.selected;
    this.items.forEach((item) => {
      const active = !this.hidden && (item.slug === this.hovered || item.slug === this.selected);
      const faded = this.dimmed || (focus && !active);
      let opacity = faded ? this.baseOpacity * 0.45 : this.baseOpacity;
      if (active) opacity += (1 - this.baseOpacity) * ACTIVE_BOOST;
      gsap.to(item.group.position, {
        y: active ? LIFT : 0,
        duration,
        ease: 'power3.out',
      });
      gsap.to(item.material, {
        opacity: this.hidden ? 0 : opacity,
        emissiveIntensity: active ? 0.22 : faded ? 0.02 : 0.08,
        duration,
      });
      gsap.to(item.lineMaterial, {
        opacity: this.hidden ? 0 : faded ? 0.3 : EDGE_OPACITY,
        duration,
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

  // Высота крыши для меток проблем; у скрытых районов метки стоят на земле.
  heightOf(slug) {
    if (this.hidden) return 0;
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
    this.group.removeFromParent();
  }
}
