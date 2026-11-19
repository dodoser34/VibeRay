import * as THREE from 'three';

const CLICK_TOLERANCE_PX = 6;

// Указатель → объект сцены (с 3D-точкой попадания). Отличает клик от перетаскивания орбиты.
export class Picker {
  constructor(camera, domElement, { getTargets, onHover, onClick, onMove }) {
    this.camera = camera;
    this.dom = domElement;
    this.getTargets = getTargets;
    this.onHover = onHover;
    this.onClick = onClick;
    this.onMove = onMove;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.downAt = null;
    this.lastHit = null;

    this.handleMove = (event) => {
      const hit = this.pick(event);
      this.onMove?.(hit);
      if (hit?.key !== this.lastHit?.key) {
        this.lastHit = hit;
        this.dom.style.cursor = hit ? 'pointer' : '';
        this.onHover(hit);
      }
    };
    this.handleDown = (event) => (this.downAt = { x: event.clientX, y: event.clientY });
    this.handleUp = (event) => {
      if (!this.downAt) return;
      const moved = Math.hypot(event.clientX - this.downAt.x, event.clientY - this.downAt.y);
      this.downAt = null;
      if (moved <= CLICK_TOLERANCE_PX) this.onClick(this.pick(event));
    };
    this.handleLeave = () => {
      this.lastHit = null;
      this.onHover(null);
    };

    domElement.addEventListener('pointermove', this.handleMove);
    domElement.addEventListener('pointerdown', this.handleDown);
    domElement.addEventListener('pointerup', this.handleUp);
    domElement.addEventListener('pointerleave', this.handleLeave);
  }

  pick(event) {
    const rect = this.dom.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const [hit] = this.raycaster.intersectObjects(this.getTargets(), false);
    if (!hit) return null;
    const data = hit.object.userData;
    if (data.kind === 'problem') {
      return {
        kind: 'problem',
        index: hit.instanceId,
        key: `problem:${hit.instanceId}`,
        point: hit.point,
      };
    }
    return { kind: 'district', slug: data.slug, key: `district:${data.slug}`, point: hit.point };
  }

  dispose() {
    this.dom.removeEventListener('pointermove', this.handleMove);
    this.dom.removeEventListener('pointerdown', this.handleDown);
    this.dom.removeEventListener('pointerup', this.handleUp);
    this.dom.removeEventListener('pointerleave', this.handleLeave);
  }
}
