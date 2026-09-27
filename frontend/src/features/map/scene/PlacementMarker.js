import * as THREE from 'three';
import { gsap } from '@/shared/animations/gsapSetup';
import { cssVar } from '@/shared/lib/cssVar';

function createPin(material) {
  const pin = new THREE.Group();
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 24, 16), material);
  head.position.y = 0.42;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.34, 20), material);
  tip.rotation.x = Math.PI; // остриём вниз, к земле
  tip.position.y = 0.2;
  pin.add(head, tip);
  return pin;
}

// Метка для «сообщить о проблеме»: полупрозрачный призрак следует за указателем над районами,
// сплошная метка отмечает выбранную точку.
export class PlacementMarker {
  constructor() {
    this.group = new THREE.Group();
    const color = new THREE.Color(cssVar('--color-accent-bright'));
    this.ghost = createPin(
      new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.45, roughness: 0.5 }),
    );
    this.pin = createPin(new THREE.MeshStandardMaterial({ color, roughness: 0.4 }));
    this.ghost.visible = false;
    this.pin.visible = false;
    this.group.add(this.ghost, this.pin);
  }

  showGhost(point) {
    this.ghost.visible = Boolean(point);
    if (point) this.ghost.position.copy(point);
  }

  place(point) {
    this.pin.visible = true;
    this.pin.position.copy(point);
    gsap.fromTo(
      this.pin.position,
      { y: point.y + 0.5 },
      { y: point.y, duration: 0.6, ease: 'bounce.out' },
    );
  }

  clear() {
    this.ghost.visible = false;
    this.pin.visible = false;
  }

  dispose() {
    gsap.killTweensOf(this.pin.position);
    this.group.traverse((object) => {
      object.geometry?.dispose();
      object.material?.dispose();
    });
    this.group.removeFromParent();
  }
}
