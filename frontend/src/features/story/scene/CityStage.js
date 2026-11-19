import * as THREE from 'three';
import {
  CityBackdrop,
  colorForAggregate,
  colorForDistrict,
  DistrictsLayer,
  MapTiles,
} from '@/features/map';
import { MOOD_BY_CODE, MOODS } from '@/shared/config/moods';
import { STATUS_BY_CODE } from '@/shared/config/problemStatuses';
import { cityOutline } from '@/shared/lib/geo/cityOutline';
import { cssVar } from '@/shared/lib/theme/cssVar';
import {
  createProjection,
  largestPolygon,
  largestRing,
  pointInPolygon,
  ringArea,
} from '@/shared/lib/geo/geoProjection';
import { createRandom } from '@/shared/lib/random';
import { LinkNetwork, PulseField } from './storyEffects';

const PEOPLE = 700;
const DOT_RADIUS = 0.045;
const PIN_HEIGHT = 0.5;
const PIN_DROP = 2.6; // км над крышами, с которых падают метки
const LINKS = 110;
// Дороги строятся волной от центра к краю: сначала каркас магистралей, следом улицы и проезды.
// REVEAL_SOFT — ширина размытого фронта волны в долях размаха города.
const REVEAL_SOFT = 0.12;
// Высота, до которой город может доходить на экране (плиты районов и жители на крышах): по ней
// считается его силуэт для кадрирования рядом с карточками истории.
const FOOTPRINT_TOP = 1;
// Кольца и дуги прозрачные: рисуются после полупрозрачных плит, иначе плиты их подкрашивают.
const EFFECTS_ORDER = 20;
const clamp01 = (value) => Math.min(1, Math.max(0, value));
const backOut = (t) => {
  const overshoot = 1.9;
  const shifted = t - 1;
  return 1 + (overshoot + 1) * shifted * shifted * shifted + overshoot * shifted * shifted;
};
const bounceOut = (t) => {
  const bounceScale = 7.5625;
  const bounceLength = 2.75;
  if (t < 1 / bounceLength) return bounceScale * t * t;
  if (t < 2 / bounceLength) return bounceScale * (t -= 1.5 / bounceLength) * t + 0.75;
  if (t < 2.5 / bounceLength) return bounceScale * (t -= 2.25 / bounceLength) * t + 0.9375;
  return bounceScale * (t -= 2.625 / bounceLength) * t + 0.984375;
};
// Прогресс 0..1 элемента i из n со сдвигом для общего прогресса p (каждый элемент занимает `span`
// диапазона).
const staggered = (progress, i, count, span = 0.25) =>
  clamp01((progress - (i / count) * (1 - span)) / span);

export const CITY_PARAMS = {
  appear: 0, // появляется плоская карта (совпадает с картой на мониторе)
  backdrop: 0, // проявляются земля и река
  streets: 0, // от центра наружу рисуются дороги, плиты становятся полупрозрачными
  rise: 0, // районы выдавливаются волной от центра наружу
  people: 0,
  moodDots: 0,
  moodMix: 0,
  problems: 0,
  links: 0,
};

// Настоящая карта города для истории, полностью управляется прогрессом прокрутки (никаких
// анимаций по времени, поэтому прокрутка назад проигрывает всё в обратную сторону).
export class CityStage {
  // detail (0…1, renderQuality из adaptations/core): на телефонах меньше жителей и связей.
  // scale — во сколько раз растянуть план города (useCityOutline с extent): любой город истории
  // одного размаха; высоты плит не меняются. renderer — рендерер сцены (плиткам нужна анизотропия).
  constructor(city, moods, problems, { detail = 1, scale = 1, renderer }) {
    this.detail = detail;
    this.group = new THREE.Group();
    const project = createProjection(city.center);
    this.project = (lonlat) => project(lonlat).map((value) => value * scale);
    // Та же подложка, что на карте города: земля и PNG-плитки дорог и воды (без загрузки схемы дорог),
    // к контуру города они гаснут; вся дорожная сеть лежит на земле под полупрозрачными плитами.
    const outlineKm = cityOutline(city.districts, city.center);
    const outline = {
      ...outlineKm,
      edges: outlineKm.edges.map(([nx, ny, distance]) => [nx, ny, distance * scale]),
      fade: outlineKm.fade * scale,
    };
    this.reach = outlineKm.reach * scale;
    this.backdrop = new CityBackdrop();
    this.tiles = new MapTiles(city.slug, outline, renderer, { scale });
    this.group.add(this.backdrop.group, this.tiles.group);

    this.districts = new DistrictsLayer(city.districts.features, this.project, {
      baseHeight: 0.25,
      heightRange: 0.55,
      lineWidth: 1.6,
      opacity: parseFloat(cssVar('--scene-district-opacity')),
      // Готовые плиты (getCity) — в км без растяжения: годятся, только если план не растянут.
      plates: scale === 1 ? city.plates : null,
    });
    this.districts.setData(moods.districts, { animate: false });
    this.group.add(this.districts.group);

    this.items = [...this.districts.items.values()].sort(
      (a, b) => a.anchor.length() - b.anchor.length(),
    );
    this.items.forEach((item) => {
      item.districtColor = colorForDistrict(item.palette);
      item.moodColor = colorForAggregate(moods.districts[item.slug]);
    });

    this.footprint = footprintOf(city.districts.features, this.project);

    this.addPeople(city.districts.features, moods.districts);
    this.addPins(problems);
    this.addLinks();
    this.lastParams = null;
    this.apply(CITY_PARAMS);
  }

  // Жители — маленькие точки на крышах; каждый получает настроение из смеси своего района.
  addPeople(features, aggregates) {
    const rand = createRandom(20260722);
    const areas = features.map((feature) => ringArea(largestRing(feature.geometry.coordinates)));
    const total = areas.reduce((sum, area) => sum + area, 0);
    this.people = [];
    features.forEach((feature, featureIndex) => {
      const polygon = largestPolygon(feature.geometry.coordinates);
      const [ring] = polygon;
      const xs = ring.map((point) => point[0]);
      const ys = ring.map((point) => point[1]);
      const bounds = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      const count = Math.max(8, Math.round((PEOPLE * this.detail * areas[featureIndex]) / total));
      const distribution = aggregates[feature.properties.slug]?.distribution;
      for (let placed = 0, guard = 0; placed < count && guard < count * 40; guard++) {
        const lonlat = [
          bounds[0] + rand() * (bounds[1] - bounds[0]),
          bounds[2] + rand() * (bounds[3] - bounds[2]),
        ];
        if (!pointInPolygon(lonlat, polygon)) continue;
        const [x, y] = this.project(lonlat);
        this.people.push({
          x,
          z: -y,
          slug: feature.properties.slug,
          mood: pickMood(distribution, rand),
          order: rand(),
        });
        placed++;
      }
    });
    this.people.sort((a, b) => a.order - b.order);
    this.neutral = new THREE.Color(cssVar('--color-text-muted'));
    this.dots = new THREE.InstancedMesh(
      new THREE.SphereGeometry(DOT_RADIUS, 10, 8),
      new THREE.MeshStandardMaterial({ roughness: 0.5 }),
      this.people.length,
    );
    this.moodPulses = new PulseField(this.people.length, { radius: 0.5, width: 0.14 });
    this.people.forEach((person, i) => {
      person.color = new THREE.Color(cssVar(MOOD_BY_CODE[person.mood].colorVar));
      this.dots.setColorAt(i, this.neutral);
    });
    this.moodPulses.mesh.renderOrder = EFFECTS_ORDER;
    this.group.add(this.dots, this.moodPulses.mesh);
  }

  // Метки проблем падают с неба, отскакивают от крыши и пускают кольцо удара.
  addPins(problems) {
    this.pins = problems.slice(0, 80).map((problem) => {
      const [x, y] = this.project(problem.location);
      return { x, z: -y, slug: problem.district, status: problem.status };
    });
    const stem = new THREE.CylinderGeometry(0.012, 0.012, 1, 6);
    stem.translate(0, 0.5, 0);
    this.pinStems = new THREE.InstancedMesh(
      stem,
      new THREE.MeshStandardMaterial({ roughness: 0.6 }),
      this.pins.length,
    );
    this.pinHeads = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.075, 16, 12),
      new THREE.MeshStandardMaterial({ roughness: 0.5 }),
      this.pins.length,
    );
    this.pinPulses = new PulseField(this.pins.length, { radius: 0.7, width: 0.12 });
    this.pins.forEach((pin, i) => {
      pin.color = new THREE.Color(cssVar(STATUS_BY_CODE[pin.status].colorVar));
      this.pinStems.setColorAt(i, pin.color);
      this.pinHeads.setColorAt(i, pin.color);
    });
    this.pinPulses.mesh.renderOrder = EFFECTS_ORDER;
    this.group.add(this.pinStems, this.pinHeads, this.pinPulses.mesh);
    this.dummy = new THREE.Object3D();
  }

  // Дуги между жителями разных районов: город как одна живая система.
  addLinks() {
    const rand = createRandom(4242);
    const pairs = [];
    const links = Math.round(LINKS * this.detail);
    for (let guard = 0; pairs.length < links && guard < links * 30; guard++) {
      const first = this.people[Math.floor(rand() * this.people.length)];
      const second = this.people[Math.floor(rand() * this.people.length)];
      const distance = Math.hypot(first.x - second.x, first.z - second.z);
      if (first.slug === second.slug || distance < 1.2 || distance > 7) continue;
      pairs.push({
        from: new THREE.Vector3(first.x, this.heightOf(first.slug) + DOT_RADIUS, first.z),
        to: new THREE.Vector3(second.x, this.heightOf(second.slug) + DOT_RADIUS, second.z),
        color: first.color,
      });
    }
    this.links = new LinkNetwork(pairs);
    this.links.lines.renderOrder = EFFECTS_ORDER;
    this.group.add(this.links.lines);
  }

  heightOf(slug) {
    return this.districts.heightOf(slug);
  }

  // Текущая высота крыши, пока плита ещё растёт (плиты единичной глубины, масштабируются по y).
  roofOf(slug) {
    return this.districts.items.get(slug)?.group.scale.y ?? 0;
  }

  apply(progress) {
    const color = new THREE.Color();
    const itemCount = this.items.length;
    this.backdrop.setOpacity(progress.backdrop);
    this.tiles.setOpacity(progress.backdrop);
    // Радиус волны: 0 — дорог нет, reach + фронт — видны до края. Вода проявляется вместе с землёй.
    const soft = this.reach * REVEAL_SOFT;
    const radius = (t) => t * (this.reach + soft);
    this.tiles.setReveal(
      {
        water: radius(1),
        major: radius(staggered(progress.streets, 0, 2, 0.55)),
        local: radius(staggered(progress.streets, 1, 2, 0.55)),
      },
      soft,
    );
    // Пока дорог нет, плиты плотные, как карта на экране; с дорогами — полупрозрачные, как на карте
    // города, и сеть видна сквозь них.
    const opacity =
      THREE.MathUtils.lerp(1, this.districts.baseOpacity, progress.streets) * progress.appear;

    this.items.forEach((item, i) => {
      const grow = staggered(progress.rise, i, itemCount, 0.35);
      item.group.scale.y = Math.max(0.02, item.height * backOut(grow));
      item.material.opacity = opacity;
      item.lineMaterial.opacity = 0.85 * progress.appear;
      color.copy(item.districtColor).lerp(item.moodColor, progress.moodMix);
      item.material.color.copy(color);
      item.material.emissive.copy(color);
    });

    const dummy = this.dummy;
    const position = new THREE.Vector3();
    const count = this.people.length;
    this.people.forEach((person, i) => {
      const grow = backOut(staggered(progress.people, i, count, 0.08));
      const top = this.roofOf(person.slug);
      position.set(person.x, top + DOT_RADIUS * grow, person.z);
      dummy.position.copy(position);
      dummy.scale.setScalar(Math.max(0.0001, grow));
      dummy.updateMatrix();
      this.dots.setMatrixAt(i, dummy.matrix);
      const mood = staggered(progress.moodDots, i, count, 0.1);
      this.dots.setColorAt(i, color.copy(this.neutral).lerp(person.color, mood));
      this.moodPulses.set(i, position.setY(top + 0.006), person.color);
      this.moodPulses.setProgress(i, mood);
    });
    this.dots.instanceMatrix.needsUpdate = true;
    this.dots.instanceColor.needsUpdate = true;
    this.moodPulses.commit();

    const pinCount = this.pins.length;
    this.pins.forEach((pin, i) => {
      const t = staggered(progress.problems, i, pinCount, 0.3);
      const base = this.roofOf(pin.slug);
      const fall = (1 - bounceOut(t)) * PIN_DROP;
      const size = t > 0 ? 1 : 0.0001;
      dummy.scale.set(size, PIN_HEIGHT * size, size);
      dummy.position.set(pin.x, base + fall, pin.z);
      dummy.updateMatrix();
      this.pinStems.setMatrixAt(i, dummy.matrix);
      dummy.scale.setScalar(size);
      dummy.position.set(pin.x, base + fall + PIN_HEIGHT, pin.z);
      dummy.updateMatrix();
      this.pinHeads.setMatrixAt(i, dummy.matrix);
      position.set(pin.x, base + 0.01, pin.z);
      this.pinPulses.set(i, position, pin.color);
      this.pinPulses.setProgress(i, clamp01((t - 0.36) / 0.64)); // кольца начинаются с первого удара
    });
    this.pinStems.instanceMatrix.needsUpdate = true;
    this.pinHeads.instanceMatrix.needsUpdate = true;
    this.pinPulses.commit();

    this.links.setReveal(progress.links);
  }

  // Центр верха района в координатах этой сцены (цели камеры).
  anchorOf(slug) {
    return this.districts.getLocalAnchor(slug) ?? new THREE.Vector3();
  }

  // Плитки нужного уровня под текущую камеру (каждый кадр, сами плитки — не чаще своего шага).
  update(camera, viewportHeight, time) {
    return this.tiles.update(camera, viewportHeight, time);
  }

  setResolution(width, height) {
    this.districts.setResolution(width, height);
  }

  dispose() {
    this.backdrop.dispose();
    this.tiles.dispose();
    this.districts.dispose();
    [this.dots, this.pinStems, this.pinHeads].forEach((mesh) => {
      mesh.geometry.dispose();
      mesh.material.dispose();
    });
    this.moodPulses.dispose();
    this.pinPulses.dispose();
    this.links.dispose();
    this.group.removeFromParent();
  }
}

// Силуэт города для кадрирования: выпуклая оболочка всех районов на земле и на высоте крыш
// (точки сцены). Камера проецирует их на экран и вписывает город в свободное от карточек место.
function footprintOf(features, project) {
  const points = features.flatMap(({ geometry }) => {
    const polygons =
      geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];
    return polygons.flatMap(([outer]) => outer.map((lonlat) => project(lonlat)));
  });
  return convexHull(points).flatMap(([x, y]) => [
    new THREE.Vector3(x, 0, -y),
    new THREE.Vector3(x, FOOTPRINT_TOP, -y),
  ]);
}

// Выпуклая оболочка точек на плоскости (монотонная цепочка Эндрю).
function convexHull(points) {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (origin, first, second) =>
    (first[0] - origin[0]) * (second[1] - origin[1]) -
    (first[1] - origin[1]) * (second[0] - origin[0]);
  const half = (list) => {
    const hull = [];
    for (const point of list) {
      while (hull.length >= 2 && cross(hull.at(-2), hull.at(-1), point) <= 0) hull.pop();
      hull.push(point);
    }
    hull.pop();
    return hull;
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}

function pickMood(distribution, rand) {
  const entries = distribution
    ? Object.entries(distribution).filter(([, count]) => count > 0)
    : MOODS.map((mood) => [mood.code, 1]);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  let roll = rand() * total;
  for (const [code, count] of entries) {
    roll -= count;
    if (roll <= 0) return code;
  }
  return entries[entries.length - 1][0];
}
