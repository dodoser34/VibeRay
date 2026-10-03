import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { cssVar } from '@/shared/lib/cssVar';
import { getLanguage } from '@/shared/lib/language';
import {
  phoneTexture,
  skyTexture,
  spineTexture,
  wallMapTexture,
  woodTexture,
} from './roomTextures';
import { ScreenTexture } from './ScreenTexture';

RectAreaLightUniformsLib.init();

// Комната истории, смоделированная в Blender (BLENDER/Scene_room_street.blend →
// public/models/story-room_street.glb): одна и та же в обеих темах, меняются только цвета (токены
// --story-* темы), свет и тени — июльская ночь в тёмной теме, тот же день в светлой. За окном (проём в стене с откосами) —
// уменьшенная улица: двор, дорога, фонари, машины, пятиэтажки и девятиэтажки, небо. Материалы названы
// по токенам дизайна («tok--story-desk-matte»); именованные меши и материалы получают живые или
// нарисованные текстуры: Screen, Sky, WallMap, DeskTop, PhoneScreen, корешки «spine-*».
const MODEL_URL = `${import.meta.env.BASE_URL}models/story-room_street.glb`;
export const SCREEN_CENTER = new THREE.Vector3(0, 1.08, -0.13);
// Середина комнаты: сюда смотрит солнце (луна), вокруг неё строится карта теней.
const ROOM_CENTER = new THREE.Vector3(0.5, 0.7, -0.2);
const SHADOW_HALF = 2.6;

// Свет по примеру интерьерных сцен: направленный свет через окно с картой теней, плотно
// охватывающей комнату; заполняющий свет неба; слабое окружение (RoomEnvironment в StoryScene) для
// отражений; экран монитора — прямоугольный источник; ночью — прожектор настольной лампы, экран
// телефона и подсветка внутри системного блока. Направление — куда идёт свет (из окна в комнату).
const VARIANTS = {
  night: {
    environment: 0.05,
    fill: { sky: '--scene-light-night', intensity: 0.9 },
    window: { token: '--scene-light-night', intensity: 2.2, direction: [-0.3, -0.55, 0.78] },
    screen: 4,
    lamp: 6,
    phone: 0.12,
    pc: 0.35,
  },
  day: {
    environment: 0.15,
    fill: { sky: '--story-sky-top', intensity: 0.8 },
    window: { token: '--story-sun', intensity: 3, direction: [-0.35, -0.6, 0.75] },
    screen: 0.8,
    lamp: 0,
    phone: 0,
    pc: 0.12,
  },
};
// Не отбрасывают тень: экран и стекло пропускают свет, небо и улица — за пределами карты теней.
const NO_SHADOW = new Set(['Screen', 'PcGlass']);

// «tok--story-desk-matte» → «--story-desk»: самый длинный префикс, который является объявленным
// токеном.
function tokenOf(materialName) {
  let token = materialName.slice(3);
  while (token.startsWith('--') && !cssVar(token)) token = token.slice(0, token.lastIndexOf('-'));
  return token.startsWith('--') ? token : null;
}

const color = (token) => new THREE.Color(cssVar(token));

export class RoomSet {
  constructor({ daylight = false, quality }) {
    this.daylight = daylight;
    this.variant = VARIANTS[daylight ? 'day' : 'night'];
    this.shadowSize = quality.detail >= 0.8 ? 2048 : 1024;
    this.group = new THREE.Group();
    this.screen = new ScreenTexture({ daylight });
    this.disposables = [this.screen];
    this.lights = [];
    // Текстуры с надписями: перерисовываются при смене языка.
    this.lettered = [];
    this.language = getLanguage();
    this.addLights();
  }

  async load() {
    const gltf = await new GLTFLoader().loadAsync(MODEL_URL);
    const { daylight } = this;
    const flat = (map) => {
      map.flipY = false; // соглашение UV в glTF
      return this.track(map);
    };
    const lettered = (map) => {
      this.lettered.push(map);
      return flat(map);
    };
    const unlit = (vars) => this.track(new THREE.MeshBasicMaterial(vars));
    const glowless = (token) => unlit({ color: color(token) });
    // Ночью окна домов, фонари и лампа горят ровным цветом; днём это обычные материалы по токенам.
    const byObject = {
      Screen: () => unlit({ map: this.screen.texture }),
      Sky: () => unlit({ map: flat(skyTexture({ daylight })), fog: false }),
      WallMap: () =>
        this.track(new THREE.MeshStandardMaterial({ map: flat(wallMapTexture()), roughness: 0.9 })),
      MonitorLed: () => glowless('--color-accent'),
      LampBulb: () => !daylight && glowless('--story-window-light'),
      WindowsLit: () => !daylight && glowless('--story-window-light'),
      StreetLamps: () => !daylight && glowless('--story-window-light'),
      PhoneScreen: () => {
        const map = lettered(phoneTexture({ daylight }));
        return daylight
          ? this.track(new THREE.MeshStandardMaterial({ map, roughness: 0.2 }))
          : unlit({ map });
      },
      PcGlass: () =>
        this.track(
          new THREE.MeshStandardMaterial({
            color: color('--story-glass'),
            transparent: true,
            opacity: 0.22,
            roughness: 0.05,
            depthWrite: false,
          }),
        ),
    };
    const byMaterial = (name) => {
      if (name === 'pc-accent') return glowless('--color-accent');
      if (name.startsWith('spine-')) {
        const map = lettered(spineTexture(name.slice(6)));
        return this.track(new THREE.MeshStandardMaterial({ map, roughness: 0.8 }));
      }
      return null;
    };
    this.screen.texture.flipY = false;

    gltf.scene.getObjectByName('StreetRoot')?.traverse((object) => (object.userData.street = true));
    gltf.scene.traverse((object) => {
      if (!object.isMesh) return;
      this.track(object.geometry);
      if (!object.userData.street && !NO_SHADOW.has(object.name)) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => this.track(material));
      const special = byObject[object.name]?.();
      if (special) {
        object.material = special;
        return;
      }
      const painted = materials.map((material) => {
        const own = byMaterial(material.name);
        if (own) return own;
        const token = tokenOf(material.name);
        if (token) material.color = color(token);
        // Матовые поверхности: глянец давал на стенах блики от окружения.
        material.roughness = Math.max(material.roughness, 0.6);
        if (object.name === 'DeskTop') material.map = flat(woodTexture());
        return material;
      });
      object.material = Array.isArray(object.material) ? painted : painted[0];
    });
    this.group.add(gltf.scene);
    gltf.scene.updateMatrixWorld(true);
    this.addPracticals(gltf.scene);
  }

  addLights() {
    const { fill, window: opening, screen } = this.variant;
    const sky = new THREE.HemisphereLight(color(fill.sky), color('--story-wall'), fill.intensity);

    const outside = new THREE.DirectionalLight(color(opening.token), opening.intensity);
    const direction = new THREE.Vector3(...opening.direction).normalize();
    outside.position.copy(ROOM_CENTER).addScaledVector(direction, -7);
    outside.target.position.copy(ROOM_CENTER);
    outside.castShadow = true;
    outside.shadow.mapSize.setScalar(this.shadowSize);
    Object.assign(outside.shadow.camera, {
      left: -SHADOW_HALF,
      right: SHADOW_HALF,
      top: SHADOW_HALF,
      bottom: -SHADOW_HALF,
      near: 1,
      far: 14,
    });
    outside.shadow.bias = -0.0004;
    outside.shadow.normalBias = 0.02;

    const monitor = new THREE.RectAreaLight(color('--scene-light'), screen, 0.6, 0.34);
    monitor.position.set(SCREEN_CENTER.x, SCREEN_CENTER.y, SCREEN_CENTER.z + 0.02);
    monitor.lookAt(SCREEN_CENTER.x, SCREEN_CENTER.y - 0.1, 1);

    this.lights.push(sky, outside, monitor);
    this.group.add(sky, outside, outside.target, monitor);
  }

  // Свет предметов комнаты: настольная лампа светит вниз на стол с мягкой тенью, экран телефона и
  // подсветка внутри корпуса — слабые точечные источники.
  addPracticals(model) {
    const { lamp, phone, pc } = this.variant;
    const at = (name, lift = 0) => {
      const point = model.getObjectByName(name)?.getWorldPosition(new THREE.Vector3());
      return point?.setY(point.y + lift);
    };
    const bulb = at('Bulb');
    if (lamp > 0 && bulb) {
      const spot = new THREE.SpotLight(color('--story-window-light'), lamp, 2.4, 0.8, 0.7, 2);
      spot.position.copy(bulb);
      spot.target.position.copy(bulb).add(new THREE.Vector3(0.15, -0.45, 0.3));
      spot.castShadow = true;
      spot.shadow.mapSize.setScalar(this.shadowSize / 2);
      spot.shadow.bias = -0.0005;
      spot.shadow.normalBias = 0.01;
      this.lights.push(spot);
      this.group.add(spot, spot.target);
    }
    const glow = (point, token, intensity, distance) => {
      if (!point || intensity <= 0) return;
      const light = new THREE.PointLight(color(token), intensity, distance, 2);
      light.position.copy(point);
      this.lights.push(light);
      this.group.add(light);
    };
    glow(at('PhoneScreen', 0.05), '--color-text', phone, 0.35);
    glow(at('Pc', 0.25), '--scene-light', pc, 0.5);
  }

  track(resource) {
    this.disposables.push(resource);
    return resource;
  }

  update(params, time) {
    if (this.language !== getLanguage()) {
      this.language = getLanguage();
      this.lettered.forEach((texture) => texture.userData.repaint());
    }
    this.screen.update(params, time);
  }

  dispose() {
    new Set(this.disposables).forEach((resource) => resource.dispose());
    this.lights.forEach((light) => light.dispose());
    this.group.removeFromParent();
  }
}
