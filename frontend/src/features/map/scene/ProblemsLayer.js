import * as THREE from 'three';
import { rootScale } from '@/adaptations/core';
import { gsap } from '@/shared/animations/gsapSetup';
import { STATUS_BY_CODE } from '@/shared/config/problemStatuses';
import { cssVar } from '@/shared/lib/cssVar';

const MAX_PROBLEMS = 1000;
const STEM_HEIGHT = 0.42;
const CLUSTER_RADIUS = 70; // px на экране (при корне 16 px): метки ближе этого сливаются в кластер
const RECLUSTER_MS = 160;
const EASE_RATE = 9; // 1/с: как быстро метки долетают до своего места или до кластера
const SCREEN_MARGIN = 80; // px за краем экрана, где кластеры ещё считаются

// Метки проблем: тонкие ножки с круглой головкой, по одному InstancedMesh на каждую часть ради
// производительности. Метки, которые на экране оказались слишком близко, собираются в кластеры:
// сами слетаются в его центр и исчезают, а при приближении разлетаются по местам.
export class ProblemsLayer {
  constructor(project) {
    this.project = project;
    this.group = new THREE.Group();
    this.problems = [];
    this.homes = [];
    this.positions = [];
    this.scales = [];
    this.targets = [];
    this.targetScales = [];
    this.clusters = [];
    this.focusId = null;
    this.dirty = true;
    this.snap = true;
    this.lastCluster = 0;
    this.cameraKey = '';
    this.dummy = new THREE.Object3D();
    this.point = new THREE.Vector3();

    this.stems = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.01, 0.01, 1, 6),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.6 }),
      MAX_PROBLEMS,
    );
    this.heads = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.055, 16, 12),
      new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.05 }),
      MAX_PROBLEMS,
    );
    this.heads.userData = { kind: 'problem' };
    this.stems.count = 0;
    this.heads.count = 0;
    this.group.add(this.stems, this.heads);
  }

  setProblems(problems, baseHeightOf) {
    const previous = new Map(this.problems.map((problem, i) => [problem.id, i]));
    const oldPositions = this.positions;
    const oldScales = this.scales;
    this.problems = problems.slice(0, MAX_PROBLEMS);
    this.homes = this.problems.map((problem) => {
      const [x, y] = this.project(problem.location);
      return new THREE.Vector3(x, baseHeightOf(problem.district), -y);
    });
    // Метки, которые уже были на карте, продолжают с того же места; новые появляются на своём.
    this.positions = this.homes.map((home, i) => {
      const before = previous.get(this.problems[i].id);
      return before === undefined ? home.clone() : oldPositions[before].clone();
    });
    this.scales = this.problems.map((problem) => {
      const before = previous.get(problem.id);
      return before === undefined ? 1 : oldScales[before];
    });
    this.targets = this.homes.map((home) => home.clone());
    this.targetScales = this.problems.map(() => 1);
    this.problems.forEach((problem, i) => {
      const color = new THREE.Color(cssVar(STATUS_BY_CODE[problem.status].colorVar));
      this.stems.setColorAt(i, color);
      this.heads.setColorAt(i, color);
    });
    this.stems.count = this.problems.length;
    this.heads.count = this.problems.length;
    if (this.stems.instanceColor) this.stems.instanceColor.needsUpdate = true;
    if (this.heads.instanceColor) this.heads.instanceColor.needsUpdate = true;
    this.dirty = true;
    this.writeMatrices(0);
  }

  // Открытая проблема никогда не прячется в кластер.
  setFocus(problemId) {
    if (problemId === this.focusId) return;
    this.focusId = problemId;
    this.dirty = true;
  }

  // Кластеры считаются в экранных пикселях, жадно: сначала открытая проблема, потом по порядку
  // списка — так «зерно» кластера и его ключ стабильны, пока камера двигается понемногу.
  // Возвращает true, если набор кластеров мог измениться.
  recluster(camera, width, height, now) {
    const key = `${camera.matrixWorld.elements.map((v) => v.toFixed(3)).join()}|${width}|${height}`;
    if (!this.dirty && (key === this.cameraKey || now - this.lastCluster < RECLUSTER_MS)) {
      return false;
    }
    this.dirty = false;
    this.cameraKey = key;
    this.lastCluster = now;

    const screen = this.homes.map((home) => {
      this.point.copy(home);
      this.group.localToWorld(this.point).project(camera);
      const x = ((this.point.x + 1) / 2) * width;
      const y = ((1 - this.point.y) / 2) * height;
      const visible =
        this.point.z < 1 &&
        x > -SCREEN_MARGIN &&
        x < width + SCREEN_MARGIN &&
        y > -SCREEN_MARGIN &&
        y < height + SCREEN_MARGIN;
      return { x, y, visible };
    });
    const order = this.problems.map((_, i) => i);
    const focus = this.problems.findIndex((problem) => problem.id === this.focusId);
    if (focus > 0) order.unshift(...order.splice(focus, 1));

    const radius = CLUSTER_RADIUS * rootScale();
    const taken = new Uint8Array(this.problems.length);
    const clusters = [];
    order.forEach((i) => {
      if (taken[i]) return;
      taken[i] = 1;
      this.targets[i].copy(this.homes[i]);
      this.targetScales[i] = 1;
      if (!screen[i].visible || i === focus) return;
      const members = [i];
      order.forEach((j) => {
        if (taken[j] || j === focus || !screen[j].visible) return;
        const dx = screen[j].x - screen[i].x;
        const dy = screen[j].y - screen[i].y;
        if (dx * dx + dy * dy > radius * radius) return;
        taken[j] = 1;
        members.push(j);
      });
      if (members.length < 2) return;
      const center = members
        .reduce((sum, m) => sum.add(this.homes[m]), new THREE.Vector3())
        .divideScalar(members.length);
      const byStatus = {};
      members.forEach((m) => {
        const { status } = this.problems[m];
        byStatus[status] = (byStatus[status] ?? 0) + 1;
        this.targets[m].copy(center);
        this.targetScales[m] = 0;
      });
      clusters.push({ key: this.problems[i].id, count: members.length, center, byStatus });
    });
    this.clusters = clusters;
    if (this.snap) {
      this.snap = false;
      this.positions.forEach((position, i) => position.copy(this.targets[i]));
      this.scales = [...this.targetScales];
    }
    return true;
  }

  // Слой снова показывают — метки сразу на своих местах, без пролёта через полкарты.
  resetMotion() {
    this.snap = true;
    this.dirty = true;
  }

  // Новые проблемы пульсируют, чтобы привлекать внимание; метки плавно догоняют свои цели.
  update(time, delta) {
    const k = 1 - Math.exp(-delta * EASE_RATE);
    this.positions.forEach((position, i) => {
      position.lerp(this.targets[i], k);
      this.scales[i] += (this.targetScales[i] - this.scales[i]) * k;
    });
    this.writeMatrices(time);
  }

  writeMatrices(time) {
    this.problems.forEach((problem, i) => {
      const position = this.positions[i];
      const s = this.scales[i];
      this.dummy.position.set(position.x, position.y + (STEM_HEIGHT / 2) * s, position.z);
      this.dummy.scale.set(s, STEM_HEIGHT * s, s);
      this.dummy.updateMatrix();
      this.stems.setMatrixAt(i, this.dummy.matrix);

      const pulse = problem.status === 'new' ? 1 + Math.sin(time * 4 + i) * 0.3 : 1;
      this.dummy.position.set(position.x, position.y + STEM_HEIGHT * s, position.z);
      this.dummy.scale.setScalar(pulse * s);
      this.dummy.updateMatrix();
      this.heads.setMatrixAt(i, this.dummy.matrix);
    });
    this.stems.instanceMatrix.needsUpdate = true;
    this.heads.instanceMatrix.needsUpdate = true;
    this.heads.computeBoundingSphere();
  }

  setVisible(visible) {
    if (visible) this.resetMotion();
    gsap.to(this.group.scale, {
      y: visible ? 1 : 0.001,
      duration: 0.6,
      ease: visible ? 'back.out(1.6)' : 'power2.in',
      onStart: () => visible && (this.group.visible = true),
      onComplete: () => !visible && (this.group.visible = false),
    });
  }

  has(problemId) {
    return this.problems.some((problem) => problem.id === problemId);
  }

  problemAt(instanceId) {
    return this.problems[instanceId] ?? null;
  }

  worldPositionOf(problem, target = new THREE.Vector3()) {
    const i = this.problems.findIndex((p) => p.id === problem.id);
    if (i === -1) return target.set(0, 0, 0);
    target.copy(this.homes[i]);
    target.y += STEM_HEIGHT;
    return this.group.localToWorld(target);
  }

  // Верх кластера (там, где стояла бы головка метки) — место для его значка.
  anchorOf(center, target = new THREE.Vector3()) {
    return target.set(center.x, center.y + STEM_HEIGHT, center.z);
  }

  dispose() {
    gsap.killTweensOf(this.group.scale);
    this.stems.dispose();
    this.heads.dispose();
    this.group.removeFromParent();
  }
}
