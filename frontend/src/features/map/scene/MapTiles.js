import * as THREE from 'three';
import { renderQuality } from '@/adaptations/core';
import { getMapTiles, mapTileUrl } from '@/shared/api/endpoints/cities';
import { cssVar } from '@/shared/lib/theme/cssVar';
import { injectEdgeFade } from './edgeFade';

const TILE_Y = 0.004; // уровень дорог: над землёй, под плитами районов
const UPDATE_MS = 120;
const MAX_LOADING = 8;
const UPLOADS_PER_FRAME = 2; // новых текстур в видеокарту за кадр — без рывков, пока плитки догружаются
const STALE_MS = 1500; // плитка из очереди, которая столько не нужна виду, не грузится
// Сколько текстур держать в памяти (грубый уровень — всегда): плитка 512 px — ~1,4 МБ видеопамяти,
// предел — ~56 МБ на телефоне и ~134 МБ на ПК.
const CACHE = { mobile: 40, tablet: 64, desktop: 96 };
// Пиксель плитки может быть во столько раз крупнее пикселя экрана: детальные плитки берутся только
// вблизи, видеопамяти нужно в разы меньше, а линии остаются чёткими.
const DETAIL_SLACK = 1.5;
// Точка плитки в единицах сцены (x — восток, y — север): для затухания у края и волны проявления.
const TILE_POINT = '(modelMatrix * vec4(position, 1.0)).xz * vec2(1.0, -1.0)';
const ALL_SHOWN = 1e9; // радиус волны, при котором видно всё (полная карта)

// Каналы маски плитки (build_map_tiles.py) накладываются слоями «поверх» в цветах темы: вода, местные
// дороги, магистрали с железной дорогой. Каждый канал виден внутри своего радиуса от центра города —
// так история «О проекте» строит дороги волной (на карте радиусы бесконечные). tileRoads гасит дороги
// плитки там, где поверх лежат чёткие векторные линии (MapVectors).
const MASK_FRAGMENT = `
vec3 tileMask = texture2D( map, vMapUv ).rgb;
tileMask *= 1.0 - smoothstep( tileReveal - tileRevealSoft, tileReveal, vec3( length( vEdgePoint ) ) );
tileMask.gb *= tileRoads;
vec4 tileColor = vec4( 0.0 );
tileColor = tileOver( tileColor, tileWater, tileMask.r );
tileColor = tileOver( tileColor, tileLocal, tileMask.g );
tileColor = tileOver( tileColor, tileMajor, tileMask.b );
diffuseColor = vec4( tileColor.rgb, tileColor.a * tileOpacity );
`;
const MASK_HEAD = `uniform vec3 tileWater;
uniform vec3 tileLocal;
uniform vec3 tileMajor;
uniform vec3 tileReveal;
uniform float tileRevealSoft;
uniform float tileOpacity;
uniform float tileRoads;
vec4 tileOver( vec4 under, vec3 color, float k ) {
  float a = k + under.a * ( 1.0 - k );
  return a > 0.0 ? vec4( ( color * k + under.rgb * under.a * ( 1.0 - k ) ) / a, a ) : under;
}
`;

// Дороги и вода города — готовые картинки (WebP), лежащие плоско под районами (пирамида уровней, как у
// веб-карт): и на карте, и в истории «О проекте». Для каждого участка в кадре берётся уровень, у
// которого пиксель плитки не крупнее пикселя экрана; участки вне кадра не грузятся. Пока детальная
// плитка грузится, на её месте видна родительская. Картинки распаковываются вне главного потока
// (ImageBitmapLoader) и уходят в видеокарту по UPLOADS_PER_FRAME за кадр. scale — во сколько раз
// растянут план города (история приводит города к одному размаху). roadMix(x, y) — доля векторных линий
// над плиткой самого детального уровня (0 — линий нет).
export class MapTiles {
  constructor(slug, outline, renderer, { scale = 1 } = {}) {
    this.slug = slug;
    this.outline = outline;
    this.renderer = renderer;
    this.scale = scale;
    this.roadMix = () => 0;
    this.group = new THREE.Group();
    this.tiles = new Map(); // ключ "z/x/y" → { texture, bitmap, mesh, ready, used }
    this.queue = [];
    this.uploads = [];
    this.loading = 0;
    this.lastUpdate = -Infinity;
    this.limit = CACHE[renderQuality().tier] ?? CACHE.desktop;
    this.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    this.loader = new THREE.ImageBitmapLoader().setOptions({
      imageOrientation: 'flipY',
      premultiplyAlpha: 'none',
      colorSpaceConversion: 'none',
    });
    this.uniforms = {
      tileWater: { value: new THREE.Color() },
      tileLocal: { value: new THREE.Color() },
      tileMajor: { value: new THREE.Color() },
      tileReveal: { value: new THREE.Vector3(ALL_SHOWN, ALL_SHOWN, ALL_SHOWN) },
      tileRevealSoft: { value: 1 },
      tileOpacity: { value: 1 },
    };
    this.setTheme();
    this.ready = getMapTiles(slug).then((manifest) => {
      if (this.disposed) return;
      this.format = manifest.format;
      this.levels = manifest.levels.map((level) => ({
        ...level,
        size: level.tileKm * scale,
        keys: new Set(level.tiles.map(([x, y]) => `${x}/${y}`)),
        geometry: new THREE.PlaneGeometry(level.tileKm * scale, level.tileKm * scale),
      }));
      this.top = this.levels.length - 1;
      this.levels[this.top].tiles.forEach(([x, y]) => this.request(this.top, x, y, 0));
    });
  }

  // Цвета слоёв — токены темы: одни и те же плитки подходят обеим темам.
  setTheme() {
    this.uniforms.tileWater.value.set(cssVar('--color-river'));
    this.uniforms.tileLocal.value.set(cssVar('--scene-road'));
    this.uniforms.tileMajor.value.set(cssVar('--scene-road-major'));
  }

  // Волна проявления: радиусы (в единицах сцены) от центра города, внутри которых видны вода,
  // местные дороги и магистрали; soft — ширина размытого фронта.
  setReveal({ water, local, major }, soft) {
    this.uniforms.tileReveal.value.set(water, local, major);
    this.uniforms.tileRevealSoft.value = soft;
  }

  setOpacity(opacity) {
    this.uniforms.tileOpacity.value = opacity;
    this.group.visible = opacity > 0.001;
  }

  // Каждый кадр из сцены: загруженные картинки уходят в видеокарту, выбор плиток — не чаще UPDATE_MS.
  // Работает и при скрытом слое: плитки загружаются заранее. true — вид изменился (нужен кадр).
  update(camera, viewportHeight, time) {
    let changed = this.flushUploads();
    if (!this.levels || time - this.lastUpdate < UPDATE_MS) return changed;
    this.lastUpdate = time;
    camera.updateMatrixWorld();
    this.frustum = new THREE.Frustum().setFromProjectionMatrix(
      new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
    );
    // Метров (настоящих, до растяжения плана) на пиксель экрана на расстоянии 1 единицы от камеры.
    this.metersPerPixelAtUnit =
      (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * 1000) /
      (viewportHeight * this.scale);
    this.camera = camera.position;
    this.shown = new Set();
    this.levels[this.top].tiles.forEach(([x, y]) => this.visit(this.top, x, y, time));
    this.tiles.forEach((tile, key) => {
      if (!tile.mesh) return;
      const visible = this.shown.has(key);
      const roads = visible && tile.z === 0 ? 1 - this.roadMix(tile.x, tile.y) : 1;
      if (tile.mesh.visible !== visible || tile.roads.value !== roads) changed = true;
      tile.mesh.visible = visible;
      tile.roads.value = roads;
    });
    this.evict(time);
    this.pump(time);
    return changed;
  }

  // Участок плитки (z, x, y): дробится на детей, если плитка грубее экрана и все её непустые дети уже
  // загружены; иначе показывается сама. Участки вне кадра пропускаются — их плитки не грузятся.
  visit(z, x, y, time) {
    const level = this.levels[z];
    const box = tileBox(level, x, y);
    if (!this.frustum.intersectsBox(box)) return;
    const key = `${z}/${x}/${y}`;
    const distance = Math.max(0.05, box.distanceToPoint(this.camera));
    const children = z > 0 ? childrenOf(this.levels[z - 1], x, y) : [];
    if (
      level.metersPerPixel > DETAIL_SLACK * distance * this.metersPerPixelAtUnit &&
      children.length
    ) {
      children.forEach(([cx, cy]) => this.request(z - 1, cx, cy, time));
      if (children.every(([cx, cy]) => this.tiles.get(`${z - 1}/${cx}/${cy}`)?.ready)) {
        children.forEach(([cx, cy]) => this.visit(z - 1, cx, cy, time));
        return;
      }
    }
    if (this.request(z, x, y, time).ready) this.shown.add(key);
  }

  request(z, x, y, time) {
    const key = `${z}/${x}/${y}`;
    let tile = this.tiles.get(key);
    if (!tile) {
      tile = { z, x, y, ready: false, used: time };
      this.tiles.set(key, tile);
      this.queue.push(tile);
    }
    tile.used = Math.max(tile.used, time);
    return tile;
  }

  // Загрузка — не больше MAX_LOADING плиток разом, грубые уровни первыми; уже ненужные — из очереди.
  pump(time) {
    this.queue = this.queue.filter((tile) => {
      const stale = tile.z !== this.top && time - tile.used > STALE_MS;
      if (stale) this.tiles.delete(`${tile.z}/${tile.x}/${tile.y}`);
      return !stale;
    });
    this.queue.sort((a, b) => b.z - a.z || b.used - a.used);
    while (this.loading < MAX_LOADING && this.queue.length) {
      const tile = this.queue.shift();
      this.loading += 1;
      this.loader.load(
        mapTileUrl(this.slug, tile.z, tile.x, tile.y, this.format),
        (bitmap) => {
          this.loading -= 1;
          if (this.disposed || this.tiles.get(`${tile.z}/${tile.x}/${tile.y}`) !== tile) {
            bitmap.close();
            return;
          }
          this.uploads.push([tile, bitmap]);
        },
        undefined,
        () => {
          this.loading -= 1;
        },
      );
    }
  }

  flushUploads() {
    let count = 0;
    while (count < UPLOADS_PER_FRAME && this.uploads.length) {
      const [tile, bitmap] = this.uploads.shift();
      if (this.disposed || this.tiles.get(`${tile.z}/${tile.x}/${tile.y}`) !== tile) {
        bitmap.close();
        continue;
      }
      this.attach(tile, bitmap);
      count += 1;
    }
    return count > 0;
  }

  attach(tile, bitmap) {
    const texture = new THREE.Texture(bitmap);
    texture.flipY = false; // строки уже перевёрнуты при распаковке (imageOrientation)
    texture.colorSpace = THREE.NoColorSpace; // маска, а не цвет
    texture.anisotropy = this.anisotropy;
    texture.needsUpdate = true;
    this.renderer.initTexture(texture);
    const level = this.levels[tile.z];
    const roads = { value: 1 };
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    });
    material.customProgramCacheKey = () => 'map-tile';
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms, { tileRoads: roads });
      injectEdgeFade(shader, this.outline, TILE_POINT);
      shader.fragmentShader = `${MASK_HEAD}${shader.fragmentShader}`.replace(
        '#include <map_fragment>',
        MASK_FRAGMENT,
      );
    };
    const mesh = new THREE.Mesh(level.geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set((tile.x + 0.5) * level.size, TILE_Y, -(tile.y + 0.5) * level.size);
    mesh.visible = false;
    this.group.add(mesh);
    Object.assign(tile, { texture, bitmap, mesh, roads, ready: true });
    this.lastUpdate = -Infinity; // новая плитка — сразу пересобрать вид
  }

  // Лишние текстуры (кроме грубого уровня) — самые давние первыми. Нужные виду сейчас (показанные и
  // дети, которых ждёт родитель) не трогаются: иначе маленький кэш выбрасывал бы загруженных детей
  // раньше, чем догрузятся их соседи, и детальный уровень не включался.
  evict(time) {
    const loaded = [...this.tiles.values()].filter((t) => t.ready && t.z !== this.top);
    const extra = loaded.length - this.limit;
    if (extra <= 0) return;
    loaded
      .filter((t) => t.used < time)
      .sort((a, b) => a.used - b.used)
      .slice(0, extra)
      .forEach((tile) => this.release(tile));
  }

  release(tile) {
    tile.texture.dispose();
    tile.bitmap.close();
    tile.mesh.material.dispose();
    tile.mesh.removeFromParent();
    this.tiles.delete(`${tile.z}/${tile.x}/${tile.y}`);
  }

  dispose() {
    this.disposed = true;
    this.tiles.forEach((tile) => tile.ready && this.release(tile));
    this.uploads.forEach(([, bitmap]) => bitmap.close());
    this.uploads = [];
    this.levels?.forEach((level) => level.geometry.dispose());
    this.group.removeFromParent();
  }
}

function tileBox({ size }, x, y) {
  return new THREE.Box3(
    new THREE.Vector3(x * size, 0, -(y + 1) * size),
    new THREE.Vector3((x + 1) * size, 0.01, -y * size),
  );
}

// Непустые дети плитки на уровень детальнее (пустые плитки скрипт не сохраняет).
function childrenOf(level, x, y) {
  return [
    [2 * x, 2 * y],
    [2 * x + 1, 2 * y],
    [2 * x, 2 * y + 1],
    [2 * x + 1, 2 * y + 1],
  ].filter(([cx, cy]) => level.keys.has(`${cx}/${cy}`));
}
