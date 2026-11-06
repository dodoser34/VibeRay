import * as THREE from 'three';
import { cssVar } from '@/shared/lib/theme/cssVar';

const GROUND_TEXTURE_SIZE = 512;

// Земля под городом — мягко освещённая плоскость, которая у краёв уходит в туман. Дороги и вода лежат
// на ней PNG-плитками (MapTiles), районы — плитами над ними.
export class CityBackdrop {
  constructor({ size = 40 } = {}) {
    this.group = new THREE.Group();
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshBasicMaterial({
        map: createGroundTexture(),
        transparent: true,
        depthWrite: false,
        // Земля лежит почти вплотную под плитками воды и дорог: сдвиг по глубине не даёт ей
        // проступать сквозь них, когда камера далеко.
        polygonOffset: true,
        polygonOffsetFactor: 4,
        polygonOffsetUnits: 4,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    // Среди прозрачных — первой: плитки, гаснущие у края города, ложатся на землю, а не на пустоту.
    ground.renderOrder = -2;
    this.group.add(ground);
  }

  setOpacity(opacity) {
    this.group.children[0].material.opacity = opacity;
    this.group.visible = opacity > 0.001;
  }

  dispose() {
    this.group.traverse((object) => {
      object.geometry?.dispose();
      object.material?.map?.dispose();
      object.material?.dispose();
    });
    this.group.removeFromParent();
  }
}

function createGroundTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = GROUND_TEXTURE_SIZE;
  const ctx = canvas.getContext('2d');
  const c = GROUND_TEXTURE_SIZE / 2;
  const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
  gradient.addColorStop(0, cssVar('--scene-ground'));
  gradient.addColorStop(0.6, cssVar('--scene-ground'));
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, GROUND_TEXTURE_SIZE, GROUND_TEXTURE_SIZE);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
