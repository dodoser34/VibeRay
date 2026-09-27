import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { cssVar } from '@/shared/lib/cssVar';
import { nightCityTexture, wallMapTexture, woodTexture } from './roomTextures';
import { ScreenTexture } from './ScreenTexture';

// Комната июльской ночи, смоделированная в Blender (docs/3d/story-room.blend →
// public/models/story-room.glb). Материалы названы по токенам дизайна («tok--story-desk-matte»),
// поэтому цвета всё равно берутся из tokens.css; именованные меши получают живые или нарисованные
// текстуры: Screen, WindowView, WallMap, DeskTop.
const ROOM_MODEL_URL = `${import.meta.env.BASE_URL}models/story-room.glb`;
export const SCREEN_CENTER = new THREE.Vector3(0, 1.08, -0.13);

// «tok--story-desk-matte» → «--story-desk»: самый длинный префикс, который является объявленным
// токеном.
function tokenOf(materialName) {
  let token = materialName.slice(3);
  while (token.startsWith('--') && !cssVar(token)) token = token.slice(0, token.lastIndexOf('-'));
  return token.startsWith('--') ? token : null;
}

export class RoomSet {
  constructor() {
    this.group = new THREE.Group();
    this.screen = new ScreenTexture();
    this.disposables = [this.screen];
    this.addLights();
  }

  async load(url = ROOM_MODEL_URL) {
    const gltf = await new GLTFLoader().loadAsync(url);
    const flat = (map) => {
      map.flipY = false; // соглашение UV в glTF
      return this.track(map);
    };
    const unlit = (vars) => this.track(new THREE.MeshBasicMaterial(vars));
    const special = {
      Screen: () => unlit({ map: this.screen.texture }),
      WindowView: () => unlit({ map: flat(nightCityTexture()) }),
      WallMap: () =>
        this.track(new THREE.MeshStandardMaterial({ map: flat(wallMapTexture()), roughness: 0.9 })),
      LampBulb: () => unlit({ color: new THREE.Color(cssVar('--story-window-light')) }),
      MonitorLed: () => unlit({ color: new THREE.Color(cssVar('--color-accent')) }),
      PhoneScreen: () => unlit({ color: new THREE.Color(cssVar('--story-screen')) }),
    };
    this.screen.texture.flipY = false;

    gltf.scene.traverse((object) => {
      if (object.name === 'Bulb') object.add(this.lampLight);
      if (!object.isMesh) return;
      this.track(object.geometry);
      this.track(object.material);
      const make = special[object.name];
      if (make) {
        object.material = make();
        return;
      }
      const token = tokenOf(object.material.name);
      if (token) object.material.color = new THREE.Color(cssVar(token));
      if (object.name === 'DeskTop') object.material.map = flat(woodTexture());
    });
    this.group.add(gltf.scene);
  }

  // Монитор — главный свет; холодный лунный свет через окно; слабый рассеянный; настольная лампа
  // добавляет небольшое тёплое пятно (при загрузке крепится к точке «Bulb» модели).
  addLights() {
    const screenLight = new THREE.PointLight(new THREE.Color(cssVar('--scene-light')), 1.6, 3, 1.6);
    screenLight.position.set(0, 1.08, 0.25);
    const moon = new THREE.DirectionalLight(new THREE.Color(cssVar('--color-river')), 0.55);
    moon.position.set(1.2, 2.2, -1.5);
    const ambient = new THREE.HemisphereLight(
      new THREE.Color(cssVar('--scene-light')),
      new THREE.Color(cssVar('--story-wall')),
      0.28,
    );
    this.lampLight = new THREE.PointLight(
      new THREE.Color(cssVar('--story-window-light')),
      0.9,
      1.1,
      1.8,
    );
    this.group.add(screenLight, moon, ambient);
  }

  track(resource) {
    this.disposables.push(resource);
    return resource;
  }

  update(params, time) {
    this.screen.update(params, time);
  }

  dispose() {
    new Set(this.disposables).forEach((resource) => resource.dispose());
    this.group.removeFromParent();
  }
}
