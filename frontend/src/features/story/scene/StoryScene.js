import * as THREE from 'three';
import { SceneRuntime } from '@/features/map';
import { cssVar } from '@/shared/lib/theme/cssVar';
import { chapterTime } from '../lib/chapters';
import { FOV, TOP_VIEW_HEIGHT, zoomFactor } from '../lib/topView';
import { CITY_PARAMS, CityStage } from './CityStage';

const FOG = [80, 160];
// Далёкая ближняя плоскость сохраняет точность глубины, поэтому границы на крышах не мерцают.
const NEAR = 0.5;
// Насколько можно увеличить или уменьшить кадр, вписывая город рядом с карточками: дальше — уже
// не кадрирование, а другой план.
const FIT_SCALE = [0.55, 1.7];

// 3D-город истории, управляемый прокруткой: начинается с главы «город», когда плоская сцена
// (изометрическая комната на ПК или телефон в руке) уходит под монтажной склейкой. Все анимируемые
// значения живут в `params` и векторах камеры и меняются одной привязанной к прокрутке шкалой GSAP,
// поэтому история играет вперёд и назад вместе с прокруткой.
export class StoryScene {
  // container — блок, по размеру которого рисуется сцена: вся сцена истории на ПК или экран
  // телефона.
  constructor(canvas, container) {
    this.runtime = new SceneRuntime(canvas, container, {
      fov: FOV,
      fogNear: FOG[0],
      fogFar: FOG[1],
      transparent: true,
      onDemand: true, // кадр — только когда прокрутка что-то сдвинула
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

    // fit — насколько город вписан в свободное от карточек место (0 — кадр камеры как есть).
    this.params = { world: 0, fit: 0, ...CITY_PARAMS };
    // Свободное место [слева, сверху, справа, снизу] в пикселях холста (setFreeArea); без него —
    // без кадрирования (телефон: карточки там — шторки поверх экрана).
    this.freeArea = null;
    this.projected = new THREE.Vector3();
    this.center = new THREE.Vector3();
    this.cameraPosition = new THREE.Vector3(0, TOP_VIEW_HEIGHT, 0.5);
    this.lookTarget = new THREE.Vector3(0, 0, 0);
    this.lastKey = '';
    this.lastView = '';

    this.runtime.onResize((width, height) => this.city?.setResolution(width, height));
    this.runtime.onTick((time) => this.tick(time));
  }

  // center — середина районов на плоской карте [x, y] (единицы истории, y — на юг): вокруг неё
  // строятся все кадры, и первый кадр совпадает с картой на экране (lib/topView.js). scale —
  // масштаб плана города (useCityOutline с extent), focus — район, куда «приземляется» история
  // (lib/storyCity.js).
  setCity(city, moods, problems, [cx, cy] = [0, 0], { scale = 1, focus } = {}) {
    if (this.city) return;
    this.focus = focus;
    this.center = new THREE.Vector3(cx, 0, cy);
    this.lookTarget.copy(this.center);
    this.cameraPosition.set(cx, TOP_VIEW_HEIGHT, cy + 0.5);
    this.city = new CityStage(city, moods, problems, {
      detail: this.runtime.quality.detail,
      scale,
      renderer: this.runtime.renderer,
    });
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
    this.runtime.invalidate();
  }

  // Где на холсте нет карточек истории — туда город вписывается в главах с колонкой карточек.
  setFreeArea(area) {
    this.freeArea = area;
    this.runtime.invalidate();
  }

  // Добавляет анимации города в шкалу истории (раскладка глав: ../lib/chapters.js).
  buildTimeline(timeline) {
    const { params, cameraPosition, lookTarget } = this;
    const focus = this.city.anchorOf(this.focus);
    const { x: ox, z: oz } = this.center;
    // Кадры вокруг середины районов (кроме подлёта к району — он в координатах самого района).
    const around = ([x, y, z]) => [x + ox, y, z + oz];
    const shot = (time, duration, position, target, ease = 'power2.inOut') =>
      timeline
        .to(
          cameraPosition,
          { x: position[0], y: position[1], z: position[2], duration, ease },
          time,
        )
        .to(lookTarget, { x: target[0], y: target[1], z: target[2], duration, ease }, time);

    // 3. Та же карта, что была на экране, теперь в 3D и строго сверху: появляются земля и река,
    // от центра наружу рисуются дороги (плиты становятся полупрозрачными), районы растут волной от
    // центра, приходят люди.
    timeline.set(params, { world: 1, appear: 1 }, chapterTime(2));
    timeline.to(params, { backdrop: 1, duration: 1.8 }, chapterTime(2, 0.2));
    timeline.to(params, { streets: 1, duration: 3.2 }, chapterTime(2, 0.3));
    timeline.to(params, { rise: 1, duration: 4.2 }, chapterTime(2, 1.8));
    shot(chapterTime(2, 2.5), 6.5, around([0, 18, 15.5]), around([0, 0, 1.2]));
    timeline.to(params, { people: 1, duration: 3.5 }, chapterTime(2, 5.5));

    // 4. Настроения: каждый житель отмечает настроение — от каждой точки расходится кольцо, районы
    // перекрашиваются.
    shot(chapterTime(3), 9, around([-7, 16, 14]), around([0, 0, 1]));
    // Справа выезжает колонка с карточкой настроения — город отходит в свободное место.
    timeline.to(params, { fit: 1, duration: 2.5, ease: 'power2.inOut' }, chapterTime(3, 0.2));
    timeline.to(params, { moodDots: 1, duration: 5 }, chapterTime(3, 2));
    timeline.to(params, { moodMix: 1, duration: 4.5 }, chapterTime(3, 4.5));

    // 5. Проблемы: подлёт к одному району, метки падают с неба и бьют в крыши.
    shot(chapterTime(4), 4, [focus.x + 3, 5.5, focus.z + 6], [focus.x, focus.y, focus.z]);
    timeline.to(params, { fit: 0, duration: 3, ease: 'power2.inOut' }, chapterTime(4));
    timeline.to(params, { problems: 1, duration: 6 }, chapterTime(4, 2.5));

    // 6. Живая карта: камера поднимается, дуги связывают жителей разных районов.
    shot(chapterTime(5), 8, around([-6, 26, 14]), around([0, 0, 0]));
    timeline.to(params, { links: 1, duration: 5.5 }, chapterTime(5, 0.3));
    // 7. Начал делать во время учёбы: медленный дрейф под планом проекта.
    shot(chapterTime(6), 10, around([-3, 24, 16]), around([0, 0, 0]));
    timeline.to(params, { fit: 1, duration: 2.5, ease: 'power2.inOut' }, chapterTime(6, 0.3));
    // 8. Продукт: вид в три четверти с местом для панелей интерфейса.
    shot(chapterTime(7), 6, around([8, 15, 14]), around([1, 0, 0]));
    // Финал: весь город сверху.
    shot(chapterTime(8), 8, around([0, TOP_VIEW_HEIGHT, 0.8]), around([0, 0, 0]));
    timeline.to(params, { fit: 0, duration: 3, ease: 'power2.inOut' }, chapterTime(8));
    return timeline;
  }

  // true — кадр изменился: сдвинулись параметры прокрутки, камера или догрузились плитки.
  tick(time) {
    const { params, runtime } = this;
    const camera = runtime.camera;
    if (!this.city) return false;
    // Плитки дорог грузятся и пока город скрыт: к главе «город» они уже на месте.
    let changed = this.city.update(camera, runtime.size.height, time * 1000);
    const inCity = params.world >= 0.5;
    if (this.city.group.visible !== inCity) changed = true;
    this.city.group.visible = inCity;
    if (inCity) {
      const key = Object.keys(CITY_PARAMS)
        .map((name) => params[name].toFixed(4))
        .join('|');
      if (key !== this.lastKey) {
        this.lastKey = key;
        this.city.apply(params);
        changed = true;
      }
    }
    camera.position
      .copy(this.cameraPosition)
      .sub(this.lookTarget)
      .multiplyScalar(zoomFactor(camera.aspect))
      .add(this.lookTarget);
    camera.lookAt(this.lookTarget);
    const offset = this.fitToFreeArea(camera);
    const view = [...camera.position.toArray(), ...this.lookTarget.toArray(), ...offset]
      .map((value) => value.toFixed(4))
      .join('|');
    if (view !== this.lastView) {
      this.lastView = view;
      changed = true;
    }
    return changed;
  }

  // Вписывает силуэт города в свободное место: кадр камеры сдвигается и масштабируется на
  // плоскости экрана (setViewOffset — без перспективных искажений, в полном разрешении). Доля
  // params.fit плавно переводит от кадра камеры как есть к вписанному. Возвращает смещение кадра.
  fitToFreeArea(camera) {
    camera.clearViewOffset();
    const weight = this.freeArea ? this.params.fit : 0;
    if (weight < 0.001 || !this.city?.footprint) return [0, 0, 1];
    const { width, height } = this.runtime.size;
    camera.updateMatrixWorld();
    let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const point of this.city.footprint) {
      const ndc = this.projected.copy(point).project(camera);
      if (ndc.z > 1) continue; // за камерой
      const x = ((ndc.x + 1) / 2) * width;
      const y = ((1 - ndc.y) / 2) * height;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    if (!(maxX > minX && maxY > minY)) return [0, 0, 1];
    const [left, top, right, bottom] = this.freeArea;
    const fitted = Math.min((right - left) / (maxX - minX), (bottom - top) / (maxY - minY));
    const scale = 1 + (Math.min(FIT_SCALE[1], Math.max(FIT_SCALE[0], fitted)) - 1) * weight;
    // Середина силуэта едет к середине свободного места; экран = scale · кадр + сдвиг.
    const from = [(minX + maxX) / 2, (minY + maxY) / 2];
    const to = [(left + right) / 2, (top + bottom) / 2];
    const shiftX = from[0] + (to[0] - from[0]) * weight - scale * from[0];
    const shiftY = from[1] + (to[1] - from[1]) * weight - scale * from[1];
    camera.setViewOffset(
      width,
      height,
      -shiftX / scale,
      -shiftY / scale,
      width / scale,
      height / scale,
    );
    return [shiftX, shiftY, scale];
  }

  dispose() {
    this.city?.dispose();
    this.runtime.dispose();
  }
}
