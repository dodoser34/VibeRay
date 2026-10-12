import * as THREE from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SceneRuntime } from '@/features/map';
import { gsap } from '@/shared/animations/gsapSetup';
import { cssVar } from '@/shared/lib/cssVar';

// Модель — экспорт из Blender (Files/girl_bust_texture.blend), геометрия сжата Draco (декодер —
// копия из three/examples в public/draco), текстуры — WebP. Только исходник без упрощения
// (≈ 27 МБ, текстуры 8K) на всех устройствах: облегчённые копии и кадр-заглушка убраны (DECISIONS).
const MODEL_URL = `${import.meta.env.BASE_URL}models/girl-bust.glb`;
const DRACO_PATH = `${import.meta.env.BASE_URL}draco/`;

const MODEL_HEIGHT = 2.4;
const CAMERA_DISTANCE = 6.2;
// Ракурс три четверти: девушка повёрнута к колонке с текстом и смотрит вверх, «задумавшись».
const TURN = -0.42;
// Рука у подбородка и центр головы в координатах модели (Y вверх, перед — +Z), доли её размеров
// от центра; радиус головы — доля высоты модели.
const HAND = new THREE.Vector3(0.02, 0.16, 0.24);
const HEAD = new THREE.Vector3(0, 0.29, 0.07);
const HEAD_RADIUS = 0.18;
// Вращение мышью или пальцем — только вокруг вертикальной оси: радиан на пиксель, затухание
// инерции, через сколько секунд после отпускания она возвращается в исходный ракурс.
const SPIN_PER_PX = 0.008;
const SPIN_DAMPING = 0.92;
const SPIN_RETURN_AFTER = 2.5;
// В покое сцена почти неподвижна (дыхание) — хватает 30 кадров; при движении — частота экрана.
const IDLE_FPS = 30;

const smoothstep = (t) => t * t * (3 - 2 * t);

// Главная: 3D-бюст девушки в правой части кадра, низ уходит под изогнутый край переднего листа.
// Её можно вращать влево-вправо мышью или пальцем, она чуть поворачивается за указателем, смотрит
// на выбранный в форме район, «ловит» метку при регистрации; прокрутка и «В город» разворачивают её
// и уводят за лист — передача на карту.
export class GirlScene {
  // onReady — модель загружена, подготовлена к отрисовке и стоит в кадре; onError — не загрузилась.
  constructor(canvas, container, { onReady, onError } = {}) {
    this.runtime = new SceneRuntime(canvas, container, {
      fov: 30,
      fogNear: 40,
      fogFar: 80,
      transparent: true,
      pauseOffscreen: true,
    });
    this.quality = this.runtime.quality;
    this.pointerX = 0;
    this.smoothPointerX = 0;
    this.fly = { progress: 0 };
    this.glanceTurn = { y: 0 };
    this.stacked = false;
    this.basePose = { position: new THREE.Vector3(), target: new THREE.Vector3() };

    // Свет комнаты как окружение: кожа, волосы и свитер читаются объёмом, а не плоской заливкой.
    const pmrem = new THREE.PMREMGenerator(this.runtime.renderer);
    this.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.runtime.scene.environment = this.environment;
    this.runtime.scene.environmentIntensity = 0.3;
    this.addLights();

    // stage — уход за лист, pivot — поворот вокруг вертикали и подскок, figure — дыхание.
    this.stage = new THREE.Group();
    this.pivot = new THREE.Group();
    this.figure = new THREE.Group();
    this.stage.add(this.pivot);
    this.pivot.add(this.figure);
    this.runtime.scene.add(this.stage);

    // Поворот за указателем — только там, где есть мышь (на тач-экранах «указатель» прыгает).
    if (this.quality.parallax) {
      this.onPointerMove = (event) => {
        this.pointerX = (event.clientX / window.innerWidth) * 2 - 1;
      };
      window.addEventListener('pointermove', this.onPointerMove);
    }
    this.bindSpin(container);

    this.runtime.onResize((width, height) => this.layout(width, height));
    this.runtime.onTick((time, delta) => this.tick(time, delta));
    this.load(onReady, onError);
  }

  load(onReady, onError) {
    this.draco = new DRACOLoader().setDecoderPath(DRACO_PATH);
    const loader = new GLTFLoader().setDRACOLoader(this.draco);
    loader
      .loadAsync(MODEL_URL)
      .then(async (gltf) => {
        if (this.disposed) return;
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const scale = MODEL_HEIGHT / size.y;
        model.scale.setScalar(scale);
        model.position.copy(center).multiplyScalar(-scale);
        const anisotropy = Math.min(8, this.runtime.renderer.capabilities.getMaxAnisotropy());
        model.traverse((object) => {
          if (object.isMesh && object.material.map) object.material.map.anisotropy = anisotropy;
        });
        this.figure.add(model);
        this.hand = HAND.clone().multiply(size).multiplyScalar(scale);
        this.head = HEAD.clone().multiply(size).multiplyScalar(scale);
        // Шейдеры и текстуры — на видеокарту заранее, иначе первый кадр с моделью дёрнется.
        await this.runtime.renderer.compileAsync(this.runtime.scene, this.runtime.camera);
        if (!this.disposed) onReady?.();
      })
      .catch((error) => {
        if (!this.disposed) onError?.(error);
      });
  }

  // Тянешь влево-вправо — девушка поворачивается вокруг себя (наклонов вверх-вниз нет), отпустил —
  // докручивается по инерции и через пару секунд плавно возвращается. Вертикальная прокрутка
  // страницы пальцем не мешает (touch-action: pan-y у контейнера).
  bindSpin(container) {
    this.spin = { angle: 0, velocity: 0, dragging: false, lastX: 0, idle: 0 };
    this.spinTarget = container;
    this.onSpinDown = (event) => {
      if (event.button !== 0) return;
      Object.assign(this.spin, { dragging: true, lastX: event.clientX, velocity: 0 });
      container.setPointerCapture(event.pointerId);
    };
    this.onSpinMove = (event) => {
      if (!this.spin.dragging) return;
      const step = (event.clientX - this.spin.lastX) * SPIN_PER_PX;
      this.spin.lastX = event.clientX;
      this.spin.angle += step;
      this.spin.velocity = step;
    };
    this.onSpinUp = () => {
      this.spin.dragging = false;
      this.spin.idle = 0;
    };
    container.addEventListener('pointerdown', this.onSpinDown);
    container.addEventListener('pointermove', this.onSpinMove);
    container.addEventListener('pointerup', this.onSpinUp);
    container.addEventListener('pointercancel', this.onSpinUp);
  }

  updateSpin(delta) {
    const spin = this.spin;
    if (spin.dragging) return;
    spin.angle += spin.velocity;
    spin.velocity *= SPIN_DAMPING ** (delta * 60);
    spin.idle += delta;
    if (spin.idle < SPIN_RETURN_AFTER) return;
    // Назад — коротким путём: полный оборот не отматывается.
    spin.angle = Math.atan2(Math.sin(spin.angle), Math.cos(spin.angle));
    spin.angle -= spin.angle * Math.min(1, delta * 2.2);
  }

  addLights() {
    const { scene } = this.runtime;
    this.hemi = new THREE.HemisphereLight(undefined, undefined, 0.45);
    // Ключевой свет слева сверху — со стороны колонки, куда она повёрнута; контровой справа сзади
    // отделяет волосы от фона. Свет нейтральный: цвета модели не окрашиваются.
    const key = new THREE.DirectionalLight(undefined, 1.25);
    key.position.set(-3, 3.5, 4);
    const rim = new THREE.DirectionalLight(undefined, 0.8);
    rim.position.set(3, 2.5, -3);
    const fill = new THREE.DirectionalLight(undefined, 0.2);
    fill.position.set(2.5, 0, 3);
    this.lightTokens = [
      [this.hemi, '--scene-light'],
      [key, '--scene-light'],
      [rim, '--scene-light'],
      [fill, '--scene-light'],
    ];
    this.paintLights();
    scene.add(this.hemi, key, rim, fill);
  }

  paintLights() {
    this.lightTokens.forEach(([light, token]) => light.color.set(cssVar(token)));
    this.hemi.groundColor.set(cssVar('--scene-ground'));
  }

  refreshTheme() {
    this.paintLights();
  }

  // Страница в одну колонку (телефоны, планшеты стоя): девушка посередине своего блока.
  setStacked(stacked) {
    if (stacked === this.stacked) return;
    this.stacked = stacked;
    const { width, height } = this.runtime.size;
    if (width && height) this.layout(width, height);
  }

  layout(width, height) {
    const camera = this.runtime.camera;
    const aspect = width / height;
    const compact = aspect < 0.9 || this.stacked;
    const distance = compact ? CAMERA_DISTANCE * 0.86 : CAMERA_DISTANCE;
    const halfWidth = distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect;
    // Широкие экраны: девушка справа, колонка входа слева; низ бюста — под краем листа.
    const shiftX = compact ? 0 : -0.4 * halfWidth;
    const shiftY = compact ? 0.05 : 0.18;
    this.basePose.target.set(shiftX, shiftY, 0);
    this.basePose.position.set(shiftX, shiftY + 0.25, distance);
    this.applyCamera();
  }

  applyCamera() {
    const camera = this.runtime.camera;
    const parallax = 1 - smoothstep(this.fly.progress);
    camera.position.copy(this.basePose.position);
    camera.position.x += this.smoothPointerX * 0.1 * parallax;
    camera.lookAt(this.basePose.target);
  }

  // Прокрутка к карте: девушка разворачивается к колонке и опускается за край листа.
  setFlyProgress(progress) {
    this.fly.progress = THREE.MathUtils.clamp(progress, 0, 1);
  }

  flyIntoCity({ duration = 1.5 } = {}) {
    return gsap.to(this.fly, { progress: 1, duration, ease: 'power2.in' });
  }

  // Выбран район в форме регистрации: быстрый взгляд в сторону формы и обратно.
  glance() {
    gsap.killTweensOf(this.glanceTurn);
    gsap.fromTo(
      this.glanceTurn,
      { y: 0 },
      { y: -0.22, duration: 0.3, ease: 'power2.out', yoyo: true, repeat: 1, repeatDelay: 0.25 },
    );
  }

  // Радость после входа: короткий подскок.
  cheer() {
    gsap.fromTo(
      this.pivot.position,
      { y: 0 },
      { y: 0.14, duration: 0.25, ease: 'power2.out', yoyo: true, repeat: 1 },
    );
  }

  // Куда прилетает метка жителя при регистрации — к руке у подбородка (px в контейнере).
  catchPoint() {
    if (!this.hand) return null;
    return this.runtime.toScreen(this.figure.localToWorld(this.hand.clone()));
  }

  // Центр головы и её радиус на экране (px в контейнере) — вокруг неё всплывают мысли.
  headPoint() {
    if (!this.head) return null;
    const center = this.figure.localToWorld(this.head.clone());
    const top = center.clone();
    top.y += HEAD_RADIUS * MODEL_HEIGHT;
    const screen = this.runtime.toScreen(center);
    return { ...screen, radius: Math.abs(screen.y - this.runtime.toScreen(top).y) };
  }

  // Движется ли что-то, кроме дыхания: тогда рисуем с частотой экрана, иначе — IDLE_FPS.
  isMoving() {
    const { spin } = this;
    return (
      spin.dragging ||
      Math.abs(spin.velocity) > 1e-4 ||
      Math.abs(spin.angle) > 1e-3 ||
      Math.abs(this.pointerX - this.smoothPointerX) > 1e-3 ||
      this.fly.progress > 0 ||
      gsap.isTweening(this.glanceTurn) ||
      gsap.isTweening(this.pivot.position)
    );
  }

  tick(time, delta) {
    this.smoothPointerX += (this.pointerX - this.smoothPointerX) * Math.min(1, delta * 3);
    this.updateSpin(delta);
    const fly = smoothstep(this.fly.progress);
    const still = 1 - fly;
    this.pivot.rotation.y =
      TURN + this.spin.angle + this.glanceTurn.y + this.smoothPointerX * 0.22 * still - fly * 0.6;
    this.figure.scale.setScalar(1 + Math.sin(time * 1.1) * 0.004 * still);
    this.stage.position.y = -fly * MODEL_HEIGHT * 0.9;
    this.applyCamera();
    this.runtime.setFrameRate(this.isMoving() ? 0 : IDLE_FPS);
  }

  dispose() {
    this.disposed = true;
    if (this.onPointerMove) window.removeEventListener('pointermove', this.onPointerMove);
    this.spinTarget.removeEventListener('pointerdown', this.onSpinDown);
    this.spinTarget.removeEventListener('pointermove', this.onSpinMove);
    this.spinTarget.removeEventListener('pointerup', this.onSpinUp);
    this.spinTarget.removeEventListener('pointercancel', this.onSpinUp);
    this.draco.dispose();
    gsap.killTweensOf([this.fly, this.glanceTurn, this.pivot.position]);
    this.environment.dispose();
    this.runtime.dispose();
  }
}
