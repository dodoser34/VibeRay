import * as THREE from 'three';
import { gsap } from '@/shared/animations/gsapSetup';
import { STATUS_BY_CODE } from '@/shared/config/problemStatuses';
import { cssVar } from '@/shared/lib/cssVar';

const MAX_PROBLEMS = 1000;
const STEM_HEIGHT = 0.42;

// Метки проблем: тонкие ножки с круглой головкой, по одному InstancedMesh на каждую часть ради
// производительности.
export class ProblemsLayer {
  constructor(project) {
    this.project = project;
    this.group = new THREE.Group();
    this.problems = [];
    this.dummy = new THREE.Object3D();

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
    this.problems = problems.slice(0, MAX_PROBLEMS);
    this.bases = this.problems.map((p) => baseHeightOf(p.district));
    this.problems.forEach((problem, i) => {
      const [x, y] = this.project(problem.location);
      const base = this.bases[i];
      this.dummy.position.set(x, base + STEM_HEIGHT / 2, -y);
      this.dummy.scale.set(1, STEM_HEIGHT, 1);
      this.dummy.updateMatrix();
      this.stems.setMatrixAt(i, this.dummy.matrix);

      const color = new THREE.Color(cssVar(STATUS_BY_CODE[problem.status].colorVar));
      this.stems.setColorAt(i, color);
      this.heads.setColorAt(i, color);
    });
    this.stems.count = this.problems.length;
    this.heads.count = this.problems.length;
    this.stems.instanceMatrix.needsUpdate = true;
    if (this.stems.instanceColor) this.stems.instanceColor.needsUpdate = true;
    if (this.heads.instanceColor) this.heads.instanceColor.needsUpdate = true;
    this.update(0);
  }

  // Новые проблемы пульсируют, чтобы привлекать внимание.
  update(time) {
    this.problems.forEach((problem, i) => {
      const [x, y] = this.project(problem.location);
      const pulse = problem.status === 'new' ? 1 + Math.sin(time * 4 + i) * 0.3 : 1;
      this.dummy.position.set(x, this.bases[i] + STEM_HEIGHT, -y);
      this.dummy.scale.setScalar(pulse);
      this.dummy.updateMatrix();
      this.heads.setMatrixAt(i, this.dummy.matrix);
    });
    this.heads.instanceMatrix.needsUpdate = true;
    this.heads.computeBoundingSphere();
  }

  setVisible(visible) {
    gsap.to(this.group.scale, {
      y: visible ? 1 : 0.001,
      duration: 0.6,
      ease: visible ? 'back.out(1.6)' : 'power2.in',
      onStart: () => visible && (this.group.visible = true),
      onComplete: () => !visible && (this.group.visible = false),
    });
  }

  problemAt(instanceId) {
    return this.problems[instanceId] ?? null;
  }

  worldPositionOf(problem, target = new THREE.Vector3()) {
    const i = this.problems.indexOf(problem);
    const [x, y] = this.project(problem.location);
    target.set(x, (this.bases[i] ?? 0) + STEM_HEIGHT, -y);
    return this.group.localToWorld(target);
  }

  dispose() {
    gsap.killTweensOf(this.group.scale);
    this.stems.dispose();
    this.heads.dispose();
    this.group.removeFromParent();
  }
}
