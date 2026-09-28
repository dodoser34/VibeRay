import * as THREE from 'three';
import { CityBackdrop, colorForAggregate, colorForDistrict, DistrictsLayer } from '@/features/map';
import { MOOD_BY_CODE, MOODS } from '@/shared/config/moods';
import { STATUS_BY_CODE } from '@/shared/config/problemStatuses';
import { cssVar } from '@/shared/lib/cssVar';
import {
  createProjection,
  largestPolygon,
  largestRing,
  pointInPolygon,
  ringArea,
} from '@/shared/lib/geoProjection';
import { createRandom } from '@/shared/lib/random';
import { LinkNetwork, PulseField } from './storyEffects';

const PEOPLE = 700;
const DOT_RADIUS = 0.045;
const PIN_HEIGHT = 0.5;
const PIN_DROP = 2.6; // км над крышами, с которых падают метки
const LINKS = 110;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const backOut = (t) => {
  const s = 1.9;
  const u = t - 1;
  return 1 + (s + 1) * u * u * u + s * u * u;
};
const bounceOut = (t) => {
  const n = 7.5625;
  const d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
};
// Прогресс 0..1 элемента i из n со сдвигом для общего прогресса p (каждый элемент занимает `span`
// диапазона).
const staggered = (p, i, n, span = 0.25) => clamp01((p - (i / n) * (1 - span)) / span);

export const CITY_PARAMS = {
  appear: 0, // появляется плоская карта (совпадает с картой на мониторе)
  backdrop: 0, // проявляются река, вода и окрестности
  streets: 0, // на крышах районов рисуются улицы
  rise: 0, // районы выдавливаются волной от центра наружу
  people: 0,
  moodDots: 0,
  moodMix: 0,
  problems: 0,
  links: 0,
};

// Настоящая карта Костаная для истории, полностью управляется прогрессом прокрутки (никаких
// анимаций по времени, поэтому прокрутка назад проигрывает всё в обратную сторону).
export class CityStage {
  // detail (0…1, renderQuality из adaptations/core): на телефонах меньше жителей и связей.
  constructor(city, moods, problems, { detail = 1 } = {}) {
    this.detail = detail;
    this.group = new THREE.Group();
    this.project = createProjection(city.center);
    this.backdrop = new CityBackdrop(this.project, { water: city.water, streets: city.streets });
    this.backdropMaterials = [];
    this.backdrop.group.traverse((object) => {
      if (!object.material) return;
      object.material.transparent = true;
      this.backdropMaterials.push([object.material, object.material.opacity]);
    });
    this.group.add(this.backdrop.group);

    this.districts = new DistrictsLayer(city.districts.features, this.project, {
      baseHeight: 0.25,
      heightRange: 0.55,
      lineWidth: 1.6,
      streets: city.streets,
      streetOpacity: 0.26,
    });
    this.districts.setData(moods.districts, { animate: false });
    this.group.add(this.districts.group);

    this.items = [...this.districts.items.values()].sort(
      (a, b) => a.anchor.length() - b.anchor.length(),
    );
    this.items.forEach((item) => {
      // Отодвигаем плиту в глубину: улицы и края лежат всего в метрах над крышей, до которой от
      // камеры 20+ км, и без смещения они мерцают сквозь неё.
      Object.assign(item.material, {
        polygonOffset: true,
        polygonOffsetFactor: 2,
        polygonOffsetUnits: 2,
      });
      item.districtColor = colorForDistrict(item.palette);
      item.moodColor = colorForAggregate(moods.districts[item.slug]);
      item.streets = item.group.children
        .filter((child) => child.userData.street)
        .map((object) => ({
          object,
          total: object.isLineSegments2
            ? object.geometry.attributes.instanceStart.count
            : object.geometry.attributes.position.count / 2,
        }));
    });

    this.addPeople(city.districts.features, moods.districts);
    this.addPins(problems);
    this.addLinks();
    this.lastParams = null;
    this.apply(CITY_PARAMS);
  }

  // Жители — маленькие точки на крышах; каждый получает настроение из смеси своего района.
  addPeople(features, aggregates) {
    const rand = createRandom(20260722);
    const areas = features.map((f) => ringArea(largestRing(f.geometry.coordinates)));
    const total = areas.reduce((a, b) => a + b, 0);
    this.people = [];
    features.forEach((feature, fi) => {
      const polygon = largestPolygon(feature.geometry.coordinates);
      const [ring] = polygon;
      const xs = ring.map((p) => p[0]);
      const ys = ring.map((p) => p[1]);
      const box = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      const count = Math.max(8, Math.round((PEOPLE * this.detail * areas[fi]) / total));
      const distribution = aggregates[feature.properties.slug]?.distribution;
      for (let n = 0, guard = 0; n < count && guard < count * 40; guard++) {
        const lonlat = [box[0] + rand() * (box[1] - box[0]), box[2] + rand() * (box[3] - box[2])];
        if (!pointInPolygon(lonlat, polygon)) continue;
        const [x, y] = this.project(lonlat);
        this.people.push({
          x,
          z: -y,
          slug: feature.properties.slug,
          mood: pickMood(distribution, rand),
          order: rand(),
        });
        n++;
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
    this.group.add(this.pinStems, this.pinHeads, this.pinPulses.mesh);
    this.dummy = new THREE.Object3D();
  }

  // Дуги между жителями разных районов: город как одна живая система.
  addLinks() {
    const rand = createRandom(4242);
    const pairs = [];
    const links = Math.round(LINKS * this.detail);
    for (let guard = 0; pairs.length < links && guard < links * 30; guard++) {
      const a = this.people[Math.floor(rand() * this.people.length)];
      const b = this.people[Math.floor(rand() * this.people.length)];
      const distance = Math.hypot(a.x - b.x, a.z - b.z);
      if (a.slug === b.slug || distance < 1.2 || distance > 7) continue;
      pairs.push({
        from: new THREE.Vector3(a.x, this.heightOf(a.slug) + DOT_RADIUS, a.z),
        to: new THREE.Vector3(b.x, this.heightOf(b.slug) + DOT_RADIUS, b.z),
        color: a.color,
      });
    }
    this.links = new LinkNetwork(pairs);
    this.group.add(this.links.lines);
  }

  heightOf(slug) {
    return this.districts.heightOf(slug);
  }

  // Текущая высота крыши, пока плита ещё растёт (плиты единичной глубины, масштабируются по y).
  roofOf(slug) {
    return this.districts.items.get(slug)?.group.scale.y ?? 0;
  }

  apply(p) {
    const color = new THREE.Color();
    const n = this.items.length;
    this.backdropMaterials.forEach(([material, opacity]) => {
      material.opacity = opacity * p.backdrop;
    });
    this.backdrop.group.visible = p.backdrop > 0.001;

    this.items.forEach((item, i) => {
      const grow = staggered(p.rise, i, n, 0.35);
      item.group.scale.y = Math.max(0.02, item.height * backOut(grow));
      item.material.opacity = this.districts.baseOpacity * p.appear;
      item.lineMaterial.opacity = 0.85 * p.appear;
      const drawn = staggered(p.streets, i, n, 0.5);
      item.streets.forEach(({ object, total }) => {
        const shown = Math.floor(total * drawn);
        if (object.isLineSegments2) object.geometry.instanceCount = shown;
        else object.geometry.setDrawRange(0, shown * 2);
      });
      color.copy(item.districtColor).lerp(item.moodColor, p.moodMix);
      item.material.color.copy(color);
      item.material.emissive.copy(color);
    });

    const d = this.dummy;
    const position = new THREE.Vector3();
    const count = this.people.length;
    this.people.forEach((person, i) => {
      const s = backOut(staggered(p.people, i, count, 0.08));
      const top = this.roofOf(person.slug);
      position.set(person.x, top + DOT_RADIUS * s, person.z);
      d.position.copy(position);
      d.scale.setScalar(Math.max(0.0001, s));
      d.updateMatrix();
      this.dots.setMatrixAt(i, d.matrix);
      const mood = staggered(p.moodDots, i, count, 0.1);
      this.dots.setColorAt(i, color.copy(this.neutral).lerp(person.color, mood));
      this.moodPulses.set(i, position.setY(top + 0.006), person.color);
      this.moodPulses.setProgress(i, mood);
    });
    this.dots.instanceMatrix.needsUpdate = true;
    this.dots.instanceColor.needsUpdate = true;
    this.moodPulses.commit();

    const pinCount = this.pins.length;
    this.pins.forEach((pin, i) => {
      const t = staggered(p.problems, i, pinCount, 0.3);
      const base = this.roofOf(pin.slug);
      const fall = (1 - bounceOut(t)) * PIN_DROP;
      const size = t > 0 ? 1 : 0.0001;
      d.scale.set(size, PIN_HEIGHT * size, size);
      d.position.set(pin.x, base + fall, pin.z);
      d.updateMatrix();
      this.pinStems.setMatrixAt(i, d.matrix);
      d.scale.setScalar(size);
      d.position.set(pin.x, base + fall + PIN_HEIGHT, pin.z);
      d.updateMatrix();
      this.pinHeads.setMatrixAt(i, d.matrix);
      position.set(pin.x, base + 0.01, pin.z);
      this.pinPulses.set(i, position, pin.color);
      this.pinPulses.setProgress(i, clamp01((t - 0.36) / 0.64)); // кольца начинаются с первого удара
    });
    this.pinStems.instanceMatrix.needsUpdate = true;
    this.pinHeads.instanceMatrix.needsUpdate = true;
    this.pinPulses.commit();

    this.links.setReveal(p.links);
  }

  // Центр верха района в координатах этой сцены (цели камеры).
  anchorOf(slug) {
    return this.districts.getLocalAnchor(slug) ?? new THREE.Vector3();
  }

  setResolution(width, height) {
    this.districts.setResolution(width, height);
    this.backdrop.setResolution(width, height);
  }

  dispose() {
    this.backdrop.dispose();
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

function pickMood(distribution, rand) {
  const entries = distribution
    ? Object.entries(distribution).filter(([, c]) => c > 0)
    : MOODS.map((m) => [m.code, 1]);
  const total = entries.reduce((a, [, c]) => a + c, 0);
  let roll = rand() * total;
  for (const [code, c] of entries) {
    roll -= c;
    if (roll <= 0) return code;
  }
  return entries[entries.length - 1][0];
}
