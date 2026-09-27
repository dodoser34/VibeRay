import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { gsap } from '@/shared/animations/gsapSetup';
import { DURATION, EASE } from '@/shared/animations/presets';

// Орбитальная камера с ограничениями + перелёты GSAP между обзором города и районом.
export class CameraRig {
  constructor(camera, domElement, { home, homeTarget = new THREE.Vector3() }) {
    this.camera = camera;
    this.home = home.clone();
    this.homeTarget = homeTarget.clone();
    this.controls = new OrbitControls(camera, domElement);
    Object.assign(this.controls, {
      enableDamping: true,
      dampingFactor: 0.08,
      minDistance: 3.5,
      maxDistance: 26,
      minPolarAngle: 0.15,
      maxPolarAngle: 1.2,
      screenSpacePanning: false,
      rotateSpeed: 0.6,
      zoomSpeed: 0.8,
    });
    camera.position.copy(this.home);
    this.controls.target.copy(this.homeTarget);
  }

  setHome(target, position) {
    this.homeTarget.copy(target);
    this.home.copy(position);
  }

  flyTo(target, { distance = 7, polar = 0.85, duration = DURATION.camera } = {}) {
    const azimuth = this.controls.getAzimuthalAngle();
    const offset = new THREE.Vector3().setFromSphericalCoords(distance, polar, azimuth);
    return this.animate(target.clone(), target.clone().add(offset), duration);
  }

  flyHome({ duration = DURATION.camera } = {}) {
    return this.animate(this.homeTarget, this.home, duration);
  }

  intro({ from, duration = 2.4, delay = 0 }) {
    this.camera.position.copy(from);
    return this.animate(this.homeTarget, this.home, duration, delay);
  }

  animate(target, position, duration, delay = 0) {
    gsap.killTweensOf([this.controls.target, this.camera.position]);
    this.controls.enabled = false;
    return gsap
      .timeline({ delay, onComplete: () => (this.controls.enabled = true) })
      .to(
        this.controls.target,
        { x: target.x, y: target.y, z: target.z, duration, ease: EASE.camera },
        0,
      )
      .to(
        this.camera.position,
        { x: position.x, y: position.y, z: position.z, duration, ease: EASE.camera },
        0,
      );
  }

  update() {
    if (this.controls.enabled) this.controls.update();
    else this.camera.lookAt(this.controls.target);
  }

  dispose() {
    gsap.killTweensOf([this.controls.target, this.camera.position]);
    this.controls.dispose();
  }
}
