import { isPhoneWidth, pixelRatioFor, renderQuality, rootScale } from '@/adaptations/core';
import { cssVar } from '@/shared/lib/theme/cssVar';

// Анимированный фон «ночной город». Один Canvas 2D: дышащий свет, дрейфующие изолинии, пыль,
// плёночное зерно, параллакс за указателем, волна по изолиниям при клике. Без свечения — изолинии
// меняют только цвет и толщину.

const TAU = Math.PI * 2;
const FPS = 30;
const PARALLAX = 12; // px, только на десктопе
const PARTICLES = 32;
const CONTOUR_SPEED = 1;
const RIPPLE_LIFE = 2; // с
const MAX_RIPPLES = 3;
const BACKGROUND_PIXELS = 3_700_000;
// [значение поля, ключ цвета, прозрачность] — чередующиеся оттенки изолиний, непрозрачность 45–80 %
const LEVELS = [
  [-0.33, 'contour', 0.55],
  [-0.22, 'contourStrong', 0.5],
  [-0.11, 'contour', 0.8],
  [0, 'contourStrong', 0.8],
  [0.11, 'contour', 0.65],
  [0.22, 'contourStrong', 0.55],
  [0.33, 'contour', 0.45],
];
const COLOR_TOKENS = {
  bg: '--color-bg',
  bgDeep: '--color-bg-deep',
  bgLight: '--color-bg-raised',
  contour: '--bg-contour',
  contourStrong: '--color-glass-border',
  pulse: '--color-accent',
  pulsePeak: '--color-accent-bright',
  dust: '--color-text-muted',
  grain: '--color-text',
};

// Улучшенный шум Перлина (3D) с фиксированным зерном, поэтому неподвижный кадр всегда одинаковый.
const PERM = new Uint8Array(512);
{
  const permutation = Array.from({ length: 256 }, (_, i) => i);
  let seed = 90210;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
  }
  for (let i = 0; i < 512; i++) PERM[i] = permutation[i & 255];
}
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (from, to, t) => from + (to - from) * t;
const grad = (hash, x, y, z) => {
  const u = hash < 8 ? x : y;
  const v = hash < 4 ? y : hash === 12 || hash === 14 ? x : z;
  return (hash & 1 ? -u : u) + (hash & 2 ? -v : v);
};

// Обозначения — как в эталонной реализации Перлина (2002): X, Y, Z — ячейка решётки, x, y, z — точка
// внутри неё, u, v, w — сглаженные доли, A…BB — хеши углов ячейки.
function noise3(x, y, z) {
  let X = Math.floor(x);
  let Y = Math.floor(y);
  let Z = Math.floor(z);
  x -= X;
  y -= Y;
  z -= Z;
  X &= 255;
  Y &= 255;
  Z &= 255;
  const u = fade(x);
  const v = fade(y);
  const w = fade(z);
  const A = PERM[X] + Y;
  const AA = PERM[A] + Z;
  const AB = PERM[A + 1] + Z;
  const B = PERM[X + 1] + Y;
  const BA = PERM[B] + Z;
  const BB = PERM[B + 1] + Z;
  return lerp(
    lerp(
      lerp(grad(PERM[AA] & 15, x, y, z), grad(PERM[BA] & 15, x - 1, y, z), u),
      lerp(grad(PERM[AB] & 15, x, y - 1, z), grad(PERM[BB] & 15, x - 1, y - 1, z), u),
      v,
    ),
    lerp(
      lerp(grad(PERM[AA + 1] & 15, x, y, z - 1), grad(PERM[BA + 1] & 15, x - 1, y, z - 1), u),
      lerp(
        grad(PERM[AB + 1] & 15, x, y - 1, z - 1),
        grad(PERM[BB + 1] & 15, x - 1, y - 1, z - 1),
        u,
      ),
      v,
    ),
    w,
  );
}

const clamp = (value, low, high) => (value < low ? low : value > high ? high : value);
const smooth = (t) => {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (from, to, t) => [
  lerp(from[0], to[0], t),
  lerp(from[1], to[1], t),
  lerp(from[2], to[2], t),
];
const rgba = (color, alpha) => `rgba(${color[0] | 0},${color[1] | 0},${color[2] | 0},${alpha})`;

function parseColor(value) {
  if (value.startsWith('rgb'))
    return value
      .match(/[\d.]+/g)
      .slice(0, 3)
      .map(Number);
  let hex = value.replace('#', '');
  if (hex.length === 3) hex = [...hex].map((digit) => digit + digit).join('');
  const packed = parseInt(hex.slice(0, 6), 16);
  return [(packed >> 16) & 255, (packed >> 8) & 255, packed & 255];
}

export class SiteBackground {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.width = 0;
    this.height = 0;
    this.pixelRatio = 1;
    this.scale = 1;
    this.time = 0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.targetOffsetX = 0;
    this.targetOffsetY = 0;
    this.ripples = [];
    this.dust = [];
    this.field = null;
    this.running = false;
    this.frameRequest = 0;
    this.lastFrameTime = 0;
    this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    this.tick = this.tick.bind(this);
    this.onPointer = (event) => {
      if (!this.width) return;
      this.targetOffsetX = clamp((event.clientX / this.width - 0.5) * 2, -1, 1);
      this.targetOffsetY = clamp((event.clientY / this.height - 0.5) * 2, -1, 1);
    };
    this.onVisibility = () => (document.hidden ? this.cancel() : this.schedule());
    this.onMotionPref = () => this.applyMode();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    window.addEventListener('pointermove', this.onPointer, { passive: true });
    document.addEventListener('visibilitychange', this.onVisibility);
    this.motionQuery.addEventListener('change', this.onMotionPref);

    this.readColors();
    this.resize();
  }

  readColors() {
    this.colors = Object.fromEntries(
      Object.entries(COLOR_TOKENS).map(([key, token]) => [key, parseColor(cssVar(token))]),
    );
    this.grain = this.makeGrain();
  }

  // Тема сменилась: цвета токенов — заново; неподвижный кадр перерисовывается сразу.
  refreshTheme() {
    this.readColors();
    if (this.running && this.isStatic) this.renderStatic();
  }

  get isStatic() {
    return this.motionQuery.matches;
  }

  get isMobile() {
    return isPhoneWidth(this.width);
  }

  start() {
    this.running = true;
    this.applyMode();
  }

  stop() {
    this.running = false;
    this.cancel();
  }

  // Мягкая волна по изолиниям из точки экрана (px окна).
  ripple(x, y) {
    if (this.isStatic || !this.running) return;
    this.ripples.push({ x, y, age: 0 });
    if (this.ripples.length > MAX_RIPPLES) this.ripples.shift();
  }

  dispose() {
    this.stop();
    this.resizeObserver.disconnect();
    window.removeEventListener('pointermove', this.onPointer);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.motionQuery.removeEventListener('change', this.onMotionPref);
    this.ripples = [];
    this.dust = [];
    this.field = null;
  }

  applyMode() {
    if (!this.running) return;
    if (this.isStatic) {
      this.cancel();
      this.renderStatic();
    } else this.schedule();
  }

  schedule() {
    if (this.running && !this.frameRequest && !document.hidden && !this.isStatic) {
      this.lastFrameTime = performance.now();
      this.frameRequest = requestAnimationFrame(this.tick);
    }
  }

  cancel() {
    if (this.frameRequest) cancelAnimationFrame(this.frameRequest);
    this.frameRequest = 0;
  }

  tick(now) {
    this.frameRequest = requestAnimationFrame(this.tick);
    const elapsed = now - this.lastFrameTime;
    if (elapsed < 1000 / FPS - 2) return; // медленному движению хватает 30 fps
    this.lastFrameTime = now;
    this.update(Math.min(elapsed, 100) / 1000);
    this.draw({ time: this.time, offsetX: this.offsetX, offsetY: this.offsetY }, false);
  }

  resize() {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (!width || !height || (width === this.width && height === this.height)) return;
    // 2D-холст, перерисовываемый 30 раз в секунду: бюджет пикселей меньше, чем у WebGL (около 2K).
    // Фон мягкий, поэтому на 4K/8K его можно рисовать в долю плотности — браузер растянет.
    this.pixelRatio = pixelRatioFor(width, height, renderQuality(width), {
      maxPixels: BACKGROUND_PIXELS,
      min: 0.35,
    });
    this.width = width;
    this.height = height;
    // Масштаб интерфейса меняется только с размером окна — читается здесь, а не в каждом кадре
    this.scale = rootScale();
    this.canvas.width = Math.round(width * this.pixelRatio);
    this.canvas.height = Math.round(height * this.pixelRatio);
    this.initDust();
    if (!this.running) return;
    if (this.isStatic) this.renderStatic();
    else this.draw({ time: this.time, offsetX: this.offsetX, offsetY: this.offsetY }, false);
  }

  initDust() {
    const count = Math.round(PARTICLES * (this.isMobile ? 0.45 : 1));
    this.dust = Array.from({ length: count }, () => this.spawnMote(true));
  }

  spawnMote(anywhere) {
    return {
      x: Math.random() * this.width,
      y: anywhere ? Math.random() * this.height : this.height + 6,
      r: 0.5 + Math.random(),
      vy: 5 + Math.random() * 9,
      amp: 4 + Math.random() * 10,
      f: TAU / (7 + Math.random() * 7),
      ph: Math.random() * TAU,
      a: 0.15 + Math.random() * 0.2,
    };
  }

  makeGrain() {
    const size = 192;
    const tile = document.createElement('canvas');
    tile.width = tile.height = size;
    const tileCtx = tile.getContext('2d');
    const image = tileCtx.createImageData(size, size);
    const [red, green, blue] = this.colors.grain;
    for (let i = 0; i < size * size; i++) {
      const offset = i * 4;
      image.data[offset] = red;
      image.data[offset + 1] = green;
      image.data[offset + 2] = blue;
      image.data[offset + 3] = Math.random() * 255;
    }
    tileCtx.putImageData(image, 0, 0);
    return this.context.createPattern(tile, 'repeat');
  }

  update(elapsed) {
    this.time += elapsed;
    const parallax = this.isMobile ? 0 : PARALLAX * this.scale;
    const easing = 1 - Math.exp(-elapsed * 2.5);
    this.offsetX += (this.targetOffsetX * parallax - this.offsetX) * easing;
    this.offsetY += (this.targetOffsetY * parallax - this.offsetY) * easing;
    this.ripples.forEach((ripple) => (ripple.age += elapsed));
    this.ripples = this.ripples.filter((ripple) => ripple.age < RIPPLE_LIFE);
    this.dust.forEach((mote) => {
      mote.y -= mote.vy * elapsed;
      if (mote.y < -6) Object.assign(mote, this.spawnMote(false));
    });
  }

  renderStatic() {
    this.draw({ time: 14, offsetX: 0, offsetY: 0 }, true);
  }

  draw(frame, still) {
    if (!this.width || !this.height) return;
    const { context, pixelRatio } = this;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    this.drawDepth(frame);
    this.drawContours(frame, still);
    if (!still) this.drawDust(frame);
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = 0.04;
    context.fillStyle = this.grain;
    context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    context.globalAlpha = 1;
  }

  // Базовый цвет, медленно блуждающее пятно света (цикл 60 с) и виньетка.
  drawDepth(frame) {
    const { context, width, height, colors } = this;
    const cycle = (TAU * frame.time) / 60;
    context.fillStyle = rgba(colors.bg, 1);
    context.fillRect(0, 0, width, height);
    const lx = width * (0.5 + 0.16 * Math.sin(cycle)) + frame.offsetX * 0.15;
    const ly = height * (0.42 + 0.08 * Math.sin(2 * cycle + 1.1)) + frame.offsetY * 0.15;
    let gradient = context.createRadialGradient(
      lx,
      ly,
      0,
      lx,
      ly,
      Math.hypot(width, height) * 0.55,
    );
    gradient.addColorStop(0, rgba(colors.bgLight, 1));
    gradient.addColorStop(0.5, rgba(colors.bgLight, 0.35));
    gradient.addColorStop(1, rgba(colors.bgLight, 0));
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    gradient = context.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.25,
      width / 2,
      height / 2,
      Math.hypot(width, height) * 0.62,
    );
    gradient.addColorStop(0, rgba(colors.bgDeep, 0));
    gradient.addColorStop(1, rgba(colors.bgDeep, 1));
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  }

  // Marching squares по двум октавам дрейфующего шума; волны изгибают поле и подкрашивают отрезки
  // изолиний, через которые проходят (цвет + толщина, никогда не ореол).
  drawContours(frame, still) {
    const { context, width, height, colors } = this;
    // Клетка — в масштабе интерфейса: на 4K/8K рисунок изолиний тот же, а клеток не в 3–10 раз больше
    const cellSize = (this.isMobile ? 26 : 16) * this.scale;
    const margin = cellSize * 2;
    const ox = frame.offsetX * 0.4;
    const oy = frame.offsetY * 0.4;
    const x0 = -margin;
    const y0 = -margin;
    const cols = Math.ceil((width + 2 * margin) / cellSize) + 1;
    const rows = Math.ceil((height + 2 * margin) / cellSize) + 1;
    if (!this.field || this.field.length < cols * rows) this.field = new Float32Array(cols * rows);
    const field = this.field;
    const contourTime = frame.time * CONTOUR_SPEED;
    const frequency = 1 / 460;
    const z = contourTime * 0.022;
    const drift = contourTime * 4;

    const rings = still
      ? []
      : this.ripples.map((ripple) => {
          const progress = ripple.age / RIPPLE_LIFE;
          return {
            x: ripple.x - ox,
            y: ripple.y - oy,
            radius: (1 - (1 - progress) ** 3) * Math.min(640, Math.max(width, height) * 0.45),
            fade: Math.min(1, progress * 6) * (1 - progress) ** 1.4,
          };
        });

    for (let j = 0; j < rows; j++) {
      const py = y0 + j * cellSize;
      for (let i = 0; i < cols; i++) {
        const px = x0 + i * cellSize;
        let value =
          (noise3((px + drift) * frequency, py * frequency, z) +
            0.5 *
              noise3(
                px * frequency * 2.1 + 11.3,
                (py - drift * 0.6) * frequency * 2.1,
                z * 1.4 + 5.7,
              )) /
          1.5;
        for (const ring of rings) {
          const distance = Math.hypot(px - ring.x, py - ring.y) - ring.radius;
          value += 0.1 * ring.fade * Math.exp(-(distance * distance) / 2900);
        }
        field[j * cols + i] = value;
      }
    }

    context.save();
    context.translate(ox, oy);
    context.lineWidth = 1;
    const lit = rings.length ? [new Path2D(), new Path2D(), new Path2D(), new Path2D()] : null;
    let path;
    const segment = (x1, y1, x2, y2) => {
      if (lit) {
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        let intensity = 0;
        for (const ring of rings) {
          const distance = Math.hypot(midX - ring.x, midY - ring.y) - ring.radius;
          intensity = Math.max(intensity, ring.fade * Math.exp(-(distance * distance) / 1570));
        }
        if (intensity > 0.06) {
          const bucket = lit[Math.min(3, (intensity * 4) | 0)];
          bucket.moveTo(x1, y1);
          bucket.lineTo(x2, y2);
          return;
        }
      }
      path.moveTo(x1, y1);
      path.lineTo(x2, y2);
    };

    for (const [level, key, alpha] of LEVELS) {
      path = new Path2D();
      for (let j = 0; j < rows - 1; j++) {
        const py = y0 + j * cellSize;
        const rowStart = j * cols;
        const nextRowStart = rowStart + cols;
        for (let i = 0; i < cols - 1; i++) {
          const topLeft = field[rowStart + i];
          const topRight = field[rowStart + i + 1];
          const bottomRight = field[nextRowStart + i + 1];
          const bottomLeft = field[nextRowStart + i];
          const caseIndex =
            (topLeft > level ? 8 : 0) |
            (topRight > level ? 4 : 0) |
            (bottomRight > level ? 2 : 0) |
            (bottomLeft > level ? 1 : 0);
          if (caseIndex === 0 || caseIndex === 15) continue;
          const px = x0 + i * cellSize;
          const tx = px + (cellSize * (level - topLeft)) / (topRight - topLeft);
          const ty = py;
          const rx = px + cellSize;
          const ry = py + (cellSize * (level - topRight)) / (bottomRight - topRight);
          const bx = px + (cellSize * (level - bottomLeft)) / (bottomRight - bottomLeft);
          const by = py + cellSize;
          const lx = px;
          const ly = py + (cellSize * (level - topLeft)) / (bottomLeft - topLeft);
          const above = (topLeft + topRight + bottomRight + bottomLeft) / 4 > level;
          switch (caseIndex) {
            case 1:
            case 14:
              segment(lx, ly, bx, by);
              break;
            case 2:
            case 13:
              segment(bx, by, rx, ry);
              break;
            case 3:
            case 12:
              segment(lx, ly, rx, ry);
              break;
            case 4:
            case 11:
              segment(tx, ty, rx, ry);
              break;
            case 6:
            case 9:
              segment(tx, ty, bx, by);
              break;
            case 7:
            case 8:
              segment(tx, ty, lx, ly);
              break;
            case 5:
              if (above) {
                segment(tx, ty, lx, ly);
                segment(rx, ry, bx, by);
              } else {
                segment(tx, ty, rx, ry);
                segment(lx, ly, bx, by);
              }
              break;
            case 10:
              if (above) {
                segment(tx, ty, rx, ry);
                segment(lx, ly, bx, by);
              } else {
                segment(tx, ty, lx, ly);
                segment(rx, ry, bx, by);
              }
              break;
          }
        }
      }
      context.strokeStyle = rgba(colors[key], alpha);
      context.stroke(path);
    }

    if (lit) {
      lit.forEach((bucket, bucketIndex) => {
        const intensity = (bucketIndex + 0.5) / 4;
        context.lineWidth = 1 + 0.5 * intensity;
        context.strokeStyle = rgba(
          mix(colors.pulse, colors.pulsePeak, intensity),
          0.35 + 0.6 * intensity,
        );
        context.stroke(bucket);
      });
      context.lineWidth = 1;
      rings.forEach((ring) => {
        context.beginPath();
        context.arc(ring.x, ring.y, Math.max(0, ring.radius), 0, TAU);
        context.strokeStyle = rgba(colors.pulse, 0.2 * ring.fade);
        context.stroke();
      });
    }
    context.restore();
  }

  drawDust(frame) {
    const { context, height, colors } = this;
    this.dust.forEach((mote) => {
      const edge =
        smooth(mote.y / (height * 0.18)) * smooth((height + 6 - mote.y) / (height * 0.1));
      if (edge <= 0) return;
      context.fillStyle = rgba(colors.dust, mote.a * edge);
      context.beginPath();
      context.arc(
        mote.x + Math.sin(this.time * mote.f + mote.ph) * mote.amp + frame.offsetX,
        mote.y + frame.offsetY,
        mote.r,
        0,
        TAU,
      );
      context.fill();
    });
  }
}
