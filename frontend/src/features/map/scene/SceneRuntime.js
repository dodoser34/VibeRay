import * as THREE from 'three';
import { pixelRatioFor, renderQuality } from '@/adaptations/core';
import { gsap } from '@/shared/animations/core/gsapSetup';
import { cssVar } from '@/shared/lib/theme/cssVar';

const WAKE_MS = 400; // после касания или колеса кадры идут ещё столько, пока сцена откликается
const WAKE_EVENTS = ['pointerdown', 'pointermove', 'wheel', 'touchstart'];
const gsapBusy = () =>
  gsap.globalTimeline.getChildren(true, true, false).some((animation) => animation.isActive());

// Общий рендерер и цикл отрисовки для всех Three.js-сцен сайта (без постобработки: спокойный вид).
// onDemand — кадр рисуется, только когда что-то изменилось: тикер вернул true, идёт твин GSAP,
// пользователь трогает сцену или кто-то вызвал invalidate(). В покое карта не тратит процессор и
// видеокарту (телефон не греется).
export class SceneRuntime {
  // transparent: сквозь пустые части сцены виден анимированный фон страницы.
  constructor(
    canvas,
    container,
    { fov = 40, fogNear = 20, fogFar = 60, transparent = false, onDemand = false } = {},
  ) {
    this.container = container;
    this.canvas = canvas;
    this.onDemand = onDemand;
    this.awakeUntil = 0;
    this.dirty = true;
    this.renderers = new Set();
    this.wake = () => this.invalidate(WAKE_MS);
    if (onDemand) {
      WAKE_EVENTS.forEach((type) => canvas.addEventListener(type, this.wake, { passive: true }));
    }
    // Плотность пикселей, сглаживание и детализация сцены зависят от устройства (adaptations/core).
    this.quality = renderQuality();
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: this.quality.antialias,
      alpha: transparent,
      powerPreference: 'high-performance',
    });
    if (transparent) this.renderer.setClearAlpha(0);
    // Нейтральный тон-маппинг сохраняет оттенки приглушённой палитры (ACES сдвигал бы и затемнял
    // их).
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1;

    this.scene = new THREE.Scene();
    if (!transparent) this.scene.background = new THREE.Color(cssVar('--scene-bg'));
    this.scene.fog = new THREE.Fog(new THREE.Color(cssVar('--scene-fog')), fogNear, fogFar);

    this.camera = new THREE.PerspectiveCamera(fov, 1, 0.05, 200);

    this.tickers = new Set();
    this.resizers = new Set();
    this.frame = null;
    this.startTime = performance.now();
    this.lastTime = this.startTime;

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.onVisibilityChange = () => (document.hidden ? this.stop() : this.start());
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    this.resize();
    this.start();
  }

  get size() {
    return { width: this.container.clientWidth, height: this.container.clientHeight };
  }

  resize() {
    const { width, height } = this.size;
    if (!width || !height) return;
    this.renderer.setPixelRatio(pixelRatioFor(width, height, this.quality));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.resizers.forEach((fn) => fn(width, height));
    this.invalidate();
  }

  // Следующий кадр нужно нарисовать (и ещё ms миллисекунд после него).
  invalidate(ms = 0) {
    this.dirty = true;
    this.awakeUntil = Math.max(this.awakeUntil, performance.now() + ms);
  }

  onTick(fn) {
    this.tickers.add(fn);
    return () => this.tickers.delete(fn);
  }

  // Вызывается сразу после отрисовки кадра (например, подписи CSS2DRenderer — только в такие кадры).
  onRender(fn) {
    this.renderers.add(fn);
    return () => this.renderers.delete(fn);
  }

  onResize(fn) {
    this.resizers.add(fn);
    const { width, height } = this.size;
    if (width && height) fn(width, height);
    return () => this.resizers.delete(fn);
  }

  start() {
    if (this.frame !== null) return;
    this.lastTime = performance.now();
    const loop = (now) => {
      const delta = Math.min((now - this.lastTime) / 1000, 0.1);
      this.lastTime = now;
      const elapsed = (now - this.startTime) / 1000;
      let changed = false;
      this.tickers.forEach((fn) => {
        if (fn(elapsed, delta)) changed = true;
      });
      if (!this.onDemand || changed || this.dirty || now < this.awakeUntil || gsapBusy()) {
        this.dirty = false;
        this.renderer.render(this.scene, this.camera);
        this.renderers.forEach((fn) => fn());
      }
      this.frame = requestAnimationFrame(loop);
    };
    this.frame = requestAnimationFrame(loop);
  }

  stop() {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
  }

  // Позиция точки мира на экране (px, относительно контейнера).
  toScreen(worldPoint) {
    const { width, height } = this.size;
    const ndc = worldPoint.clone().project(this.camera);
    return { x: ((ndc.x + 1) / 2) * width, y: ((1 - ndc.y) / 2) * height };
  }

  dispose() {
    this.stop();
    this.resizeObserver.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    WAKE_EVENTS.forEach((type) => this.canvas.removeEventListener(type, this.wake));
    this.tickers.clear();
    this.resizers.clear();
    this.renderers.clear();
    this.scene.traverse((object) => {
      object.geometry?.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.filter(Boolean).forEach((material) => {
        Object.values(material).forEach((value) => value?.isTexture && value.dispose());
        material.dispose();
      });
    });
    this.renderer.dispose();
  }
}
