import * as THREE from 'three';
import { SceneRuntime } from '@/features/map';
import { cssVar } from '@/shared/lib/theme/cssVar';
import { at } from '../lib/chapters';
import { FOV, TOP_VIEW_HEIGHT, zoomFactor } from '../lib/topView';
import { CITY_PARAMS, CityStage } from './CityStage';

// Куда «приземляется» история, когда район показывают крупно.
const FOCUS_DISTRICT = 'center';
const FOG = [80, 160];
// Далёкая ближняя плоскость сохраняет точность глубины, поэтому улицы на крышах не мерцают.
const NEAR = 0.5;

// 3D-город истории, управляемый прокруткой: начинается с главы «город», когда плоская сцена
// (изометрическая комната на ПК или телефон в руке) уходит под монтажной склейкой. Все анимируемые
// значения живут в `params` и векторах камеры и меняются одной привязанной к прокрутке шкалой GSAP,
// поэтому история играет вперёд и назад вместе с прокруткой.
export class StoryScene {
  // container — блок, по размеру которого рисуется сцена: вся сцена истории на ПК или экран телефона.
  constructor(canvas, container) {
    this.runtime = new SceneRuntime(canvas, container, {
      fov: FOV,
      fogNear: FOG[0],
      fogFar: FOG[1],
      transparent: true,
    });
    this.runtime.camera.near = NEAR;
    this.runtime.camera.updateProjectionMatrix();
    // Готовность к показу: первый кадр отрисован (three.js и шейдеры уже на месте).
    this.ready = new Promise((resolve) => {
      const off = this.runtime.onTick(() => {
        off();
        resolve();
      });
    });

    this.params = { world: 0, ...CITY_PARAMS };
    this.center = new THREE.Vector3();
    this.cam = new THREE.Vector3(0, TOP_VIEW_HEIGHT, 0.5);
    this.look = new THREE.Vector3(0, 0, 0);
    this.lastKey = '';

    this.runtime.onResize((width, height) => this.city?.setResolution(width, height));
    this.runtime.onTick(() => this.tick());
  }

  // center — середина районов на плоской карте [x, y] (км, y — на юг): вокруг неё строятся все кадры,
  // и первый кадр совпадает с картой на экране (lib/topView.js).
  setCity(city, moods, problems, [cx, cy] = [0, 0]) {
    if (this.city) return;
    this.center = new THREE.Vector3(cx, 0, cy);
    this.look.copy(this.center);
    this.cam.set(cx, TOP_VIEW_HEIGHT, cy + 0.5);
    this.city = new CityStage(city, moods, problems, { detail: this.runtime.quality.detail });
    this.city.group.visible = false;
    const lights = new THREE.Group();
    lights.add(
      new THREE.HemisphereLight(
        new THREE.Color(cssVar('--scene-light')),
        new THREE.Color(cssVar('--scene-ground')),
        1.6,
      ),
    );
    const key = new THREE.DirectionalLight(new THREE.Color(cssVar('--scene-light')), 2);
    key.position.set(-6, 12, 8);
    lights.add(key);
    this.city.group.add(lights);
    this.runtime.scene.add(this.city.group);
    const { width, height } = this.runtime.size;
    this.city.setResolution(width, height);
  }

  // Добавляет анимации города в шкалу истории (раскладка глав: ../lib/chapters.js).
  buildTimeline(tl) {
    const { params: p, cam, look } = this;
    const focus = this.city.anchorOf(FOCUS_DISTRICT);
    const { x: ox, z: oz } = this.center;
    // Кадры вокруг середины районов (кроме подлёта к району — он в координатах самого района).
    const around = ([x, y, z]) => [x + ox, y, z + oz];
    const shot = (time, duration, position, target, ease = 'power2.inOut') =>
      tl
        .to(cam, { x: position[0], y: position[1], z: position[2], duration, ease }, time)
        .to(look, { x: target[0], y: target[1], z: target[2], duration, ease }, time);

    // 3. Та же карта, что была на экране, теперь в 3D и строго сверху: появляются окрестности и
    // река, рисуются улицы, районы растут волной от центра, приходят люди.
    tl.set(p, { world: 1, appear: 1 }, at(2));
    tl.to(p, { backdrop: 1, duration: 1.8 }, at(2, 0.2));
    tl.to(p, { streets: 1, duration: 3.2 }, at(2, 0.3));
    tl.to(p, { rise: 1, duration: 4.2 }, at(2, 1.8));
    shot(at(2, 2.5), 6.5, around([0, 18, 15.5]), around([0, 0, 1.2]));
    tl.to(p, { people: 1, duration: 3.5 }, at(2, 5.5));

    // 4. Настроения: каждый житель отмечает настроение — от каждой точки расходится кольцо, районы
    // перекрашиваются.
    shot(at(3), 9, around([-7, 16, 14]), around([0, 0, 1]));
    tl.to(p, { moodDots: 1, duration: 5 }, at(3, 2));
    tl.to(p, { moodMix: 1, duration: 4.5 }, at(3, 4.5));

    // 5. Проблемы: подлёт к одному району, метки падают с неба и бьют в крыши.
    shot(at(4), 4, [focus.x + 3, 5.5, focus.z + 6], [focus.x, focus.y, focus.z]);
    tl.to(p, { problems: 1, duration: 6 }, at(4, 2.5));

    // 6. Живая карта: камера поднимается, дуги связывают жителей разных районов.
    shot(at(5), 8, around([-6, 26, 14]), around([0, 0, 0]));
    tl.to(p, { links: 1, duration: 5.5 }, at(5, 0.3));
    // 7. Начал делать во время учёбы: медленный дрейф под планом проекта.
    shot(at(6), 10, around([-3, 24, 16]), around([0, 0, 0]));
    // 8. Продукт: вид в три четверти с местом для панелей интерфейса.
    shot(at(7), 6, around([8, 15, 14]), around([1, 0, 0]));
    // Финал: весь город сверху.
    shot(at(8), 8, around([0, TOP_VIEW_HEIGHT, 0.8]), around([0, 0, 0]));
    return tl;
  }

  tick() {
    const { params: p, runtime } = this;
    const camera = runtime.camera;
    if (!this.city) return;
    const inCity = p.world >= 0.5;
    this.city.group.visible = inCity;
    if (inCity) {
      const key = Object.keys(CITY_PARAMS)
        .map((name) => p[name].toFixed(4))
        .join('|');
      if (key !== this.lastKey) {
        this.lastKey = key;
        this.city.apply(p);
      }
    }
    camera.position
      .copy(this.cam)
      .sub(this.look)
      .multiplyScalar(zoomFactor(camera.aspect))
      .add(this.look);
    camera.lookAt(this.look);
  }

  dispose() {
    this.city?.dispose();
    this.runtime.dispose();
  }
}
