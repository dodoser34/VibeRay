import * as THREE from 'three';
import { pixelRatioFor, renderQuality } from '@/adaptations/core';
import { cssVar } from '@/shared/lib/cssVar';

// Общий рендерер и цикл отрисовки для всех Three.js-сцен сайта (без постобработки: спокойный вид).
export class SceneRuntime {
  // transparent: сквозь пустые части сцены виден анимированный фон страницы; shadows: карта теней
  // (мягкие PCF-тени, нужны комнате истории).
  constructor(
    canvas,
    container,
    { fov = 40, fogNear = 20, fogFar = 60, transparent = false, shadows = false } = {},
  ) {
    this.container = container;
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
    if (shadows) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

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
  }

  onTick(fn) {
    this.tickers.add(fn);
    return () => this.tickers.delete(fn);
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
      this.tickers.forEach((fn) => fn(elapsed, delta));
      this.renderer.render(this.scene, this.camera);
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
    this.tickers.clear();
    this.resizers.clear();
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
