import * as THREE from 'three';
import { SceneRuntime } from '@/features/map';
import { cssVar } from '@/shared/lib/cssVar';
import { createProjection } from '@/shared/lib/geoProjection';
import { CHAPTER } from '../content';
import { CITY_PARAMS, CityStage } from './CityStage';
import { RoomSet, SCREEN_CENTER } from './RoomSet';

const FOV = 38;
// Куда «приземляется» история, когда район показывают крупно.
const FOCUS_DISTRICT = 'center';
// Первый кадр города смотрит строго вниз с этой высоты (км); карта на мониторе в той же рамке.
const TOP_VIEW_HEIGHT = 30;
// Ближняя плоскость: сантиметры в комнате (камера влетает в экран), метры над городом — далёкая
// ближняя плоскость сохраняет точность глубины, поэтому улицы на крышах не мерцают.
const NEAR_ROOM = 0.02;
const NEAR_CITY = 0.5;
// В конце нырка камера видит ~63 % высоты монитора, поэтому карта на мониторе рисуется во столько
// же раз меньше, чтобы точно совпасть с первым кадром города.
const SCREEN_MAP_SCALE = 1.6;
const at = (chapter, offset = 0) => chapter * CHAPTER + offset;

// Сцена истории, управляемая прокруткой. Все анимируемые значения живут в `params` и векторах
// камеры и меняются одной привязанной к прокрутке шкалой GSAP, поэтому история играет вперёд и
// назад вместе с прокруткой.
export class StoryScene {
  constructor(canvas, container) {
    this.runtime = new SceneRuntime(canvas, container, {
      fov: FOV,
      fogNear: 80,
      fogFar: 160,
      transparent: true,
    });
    this.room = new RoomSet();
    this.runtime.scene.add(this.room.group);
    this.room.load().catch((error) => console.error('Story room model failed to load', error));

    this.params = { world: 0, ideas: 0, typed: 0, mapIn: 0, ...CITY_PARAMS };
    this.cam = new THREE.Vector3(1.9, 1.55, 2.3);
    this.look = new THREE.Vector3(0.25, 1.15, -0.35);
    this.lastKey = '';

    this.runtime.onResize((width, height) => {
      this.city?.setResolution(width, height);
      this.frameFor(width, height);
    });
    this.runtime.onTick((time) => this.tick(time));
  }

  setCity(city, moods, problems) {
    if (this.city) return;
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

    const viewHeightKm =
      2 *
      TOP_VIEW_HEIGHT *
      SCREEN_MAP_SCALE *
      this.zoomFactor() *
      Math.tan(THREE.MathUtils.degToRad(FOV) / 2);
    this.room.screen.setMap(city.districts.features, createProjection(city.center), {
      viewHeightKm,
    });
  }

  // Добавляет анимации сцены в шкалу истории (раскладка глав: ../content.js).
  buildTimeline(tl) {
    const { params: p, cam, look } = this;
    const focus = this.city.anchorOf(FOCUS_DISTRICT);
    const shot = (time, duration, position, target, ease = 'power2.inOut') =>
      tl
        .to(cam, { x: position[0], y: position[1], z: position[2], duration, ease }, time)
        .to(look, { x: target[0], y: target[1], z: target[2], duration, ease }, time);
    const screen = SCREEN_CENTER.toArray();

    // 1. Июльская ночь: наезд на монитор.
    shot(at(0), 9, [0.55, 1.2, 1.05], [0.05, SCREEN_CENTER.y, SCREEN_CENTER.z]);
    // 2. Идеи мелькают и зачёркиваются, печатается вопрос, карта города занимает экран, камера
    // ныряет в неё.
    shot(at(1), 5, [0, SCREEN_CENTER.y, 0.5], screen);
    tl.to(p, { ideas: 1, duration: 4.5 }, at(1, 0.5));
    tl.to(p, { typed: 1, duration: 2.4 }, at(1, 5));
    shot(at(1, 5), 3, [0, SCREEN_CENTER.y, 0.36], screen);
    tl.to(p, { mapIn: 1, duration: 1.3 }, at(1, 7.6));
    shot(at(1, 8.2), 1.6, [0, SCREEN_CENTER.y, 0.2], screen, 'power2.in');

    // 3. Та же карта, теперь в 3D и строго сверху: появляются окрестности и река, рисуются улицы,
    // районы растут волной от центра, приходят люди.
    tl.set(p, { world: 1, appear: 1 }, at(2));
    tl.set(cam, { x: 0, y: TOP_VIEW_HEIGHT, z: 0.5 }, at(2));
    tl.set(look, { x: 0, y: 0, z: 0 }, at(2));
    tl.to(p, { backdrop: 1, duration: 1.8 }, at(2, 0.2));
    tl.to(p, { streets: 1, duration: 3.2 }, at(2, 0.3));
    tl.to(p, { rise: 1, duration: 4.2 }, at(2, 1.8));
    shot(at(2, 2.5), 6.5, [0, 18, 15.5], [0, 0, 1.2]);
    tl.to(p, { people: 1, duration: 3.5 }, at(2, 5.5));

    // 4. Настроения: каждый житель отмечает настроение — от каждой точки расходится кольцо, районы
    // перекрашиваются.
    shot(at(3), 9, [-7, 16, 14], [0, 0, 1]);
    tl.to(p, { moodDots: 1, duration: 5 }, at(3, 2));
    tl.to(p, { moodMix: 1, duration: 4.5 }, at(3, 4.5));

    // 5. Проблемы: подлёт к одному району, метки падают с неба и бьют в крыши.
    shot(at(4), 4, [focus.x + 3, 5.5, focus.z + 6], [focus.x, focus.y, focus.z]);
    tl.to(p, { problems: 1, duration: 6 }, at(4, 2.5));

    // 6. Живая карта: камера поднимается, дуги связывают жителей разных районов.
    shot(at(5), 8, [-6, 26, 14], [0, 0, 0]);
    tl.to(p, { links: 1, duration: 5.5 }, at(5, 0.3));
    // 7. «4-й год»: медленный дрейф под календарём.
    shot(at(6), 10, [-3, 24, 16], [0, 0, 0]);
    // 8. Продукт: вид в три четверти с местом для панелей интерфейса.
    shot(at(7), 6, [8, 15, 14], [1, 0, 0]);
    // Финал: весь город сверху.
    shot(at(8), 8, [0, TOP_VIEW_HEIGHT, 0.8], [0, 0, 0]);
    return tl;
  }

  // Портретные экраны видят меньше по горизонтали — отступаем вдоль направления взгляда, но мягко:
  // комната и город на телефоне остаются крупными, а не висят мелкими в пустоте.
  zoomFactor() {
    const { aspect } = this.runtime.camera;
    return aspect < 1 ? 1.3 / Math.sqrt(aspect) : Math.max(1, 1.3 / aspect);
  }

  // На портретных экранах подписи и карточки истории внизу: центр картинки поднимается в свободную
  // часть над ними.
  frameFor(width, height) {
    const { camera } = this.runtime;
    if (width < height) camera.setViewOffset(width, height, 0, height * 0.1, width, height);
    else camera.clearViewOffset();
  }

  tick(time) {
    const { params: p, runtime } = this;
    const camera = runtime.camera;
    const inCity = p.world >= 0.5 && this.city;
    this.room.group.visible = !inCity;
    if (this.city) this.city.group.visible = Boolean(inCity);
    const near = inCity ? NEAR_CITY : NEAR_ROOM;
    if (camera.near !== near) {
      camera.near = near;
      camera.updateProjectionMatrix();
    }
    if (inCity) {
      const key = Object.keys(CITY_PARAMS)
        .map((name) => p[name].toFixed(4))
        .join('|');
      if (key !== this.lastKey) {
        this.lastKey = key;
        this.city.apply(p);
      }
    } else {
      this.room.update(p, time);
    }
    camera.position.copy(this.cam).sub(this.look).multiplyScalar(this.zoomFactor()).add(this.look);
    camera.lookAt(this.look);
  }

  dispose() {
    this.city?.dispose();
    this.room.dispose();
    this.runtime.dispose();
  }
}
