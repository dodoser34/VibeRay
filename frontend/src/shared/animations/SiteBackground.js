import { pixelRatioFor, renderQuality } from '@/adaptations/core';
import { cssVar } from '@/shared/lib/cssVar';

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
const MOBILE_WIDTH = 900;
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
  const p = Array.from({ length: 256 }, (_, i) => i);
  let seed = 90210;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
}
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;
const grad = (hash, x, y, z) => {
  const u = hash < 8 ? x : y;
  const v = hash < 4 ? y : hash === 12 || hash === 14 ? x : z;
  return (hash & 1 ? -u : u) + (hash & 2 ? -v : v);
};

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

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (t) => {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

function parseColor(value) {
  if (value.startsWith('rgb'))
    return value
      .match(/[\d.]+/g)
      .slice(0, 3)
      .map(Number);
  let hex = value.replace('#', '');
  if (hex.length === 3) hex = [...hex].map((c) => c + c).join('');
  const n = parseInt(hex.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export class SiteBackground {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = 0;
    this.h = 0;
    this.dpr = 1;
    this.t = 0;
    this.px = 0;
    this.py = 0;
    this.ptx = 0;
    this.pty = 0;
    this.ripples = [];
    this.dust = [];
    this.field = null;
    this.running = false;
    this.raf = 0;
    this.last = 0;
    this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    this.tick = this.tick.bind(this);
    this.onPointer = (event) => {
      if (!this.w) return;
      this.ptx = clamp((event.clientX / this.w - 0.5) * 2, -1, 1);
      this.pty = clamp((event.clientY / this.h - 0.5) * 2, -1, 1);
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
    return this.w < MOBILE_WIDTH;
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
    if (this.running && !this.raf && !document.hidden && !this.isStatic) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.tick);
    }
  }

  cancel() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  tick(now) {
    this.raf = requestAnimationFrame(this.tick);
    const elapsed = now - this.last;
    if (elapsed < 1000 / FPS - 2) return; // медленному движению хватает 30 fps
    this.last = now;
    this.update(Math.min(elapsed, 100) / 1000);
    this.draw({ t: this.t, ox: this.px, oy: this.py }, false);
  }

  resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h || (w === this.w && h === this.h)) return;
    // 2D-холст, перерисовываемый 30 раз в секунду: бюджет пикселей меньше, чем у WebGL (около 2K).
    this.dpr = pixelRatioFor(w, h, renderQuality(w), {
      maxPixels: BACKGROUND_PIXELS,
      min: 0.75,
    });
    this.w = w;
    this.h = h;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.initDust();
    if (!this.running) return;
    if (this.isStatic) this.renderStatic();
    else this.draw({ t: this.t, ox: this.px, oy: this.py }, false);
  }

  initDust() {
    const count = Math.round(PARTICLES * (this.isMobile ? 0.45 : 1));
    this.dust = Array.from({ length: count }, () => this.mote(true));
  }

  mote(anywhere) {
    return {
      x: Math.random() * this.w,
      y: anywhere ? Math.random() * this.h : this.h + 6,
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
    const [r, g, b] = this.colors.grain;
    for (let i = 0; i < size * size; i++) {
      const o = i * 4;
      image.data[o] = r;
      image.data[o + 1] = g;
      image.data[o + 2] = b;
      image.data[o + 3] = Math.random() * 255;
    }
    tileCtx.putImageData(image, 0, 0);
    return this.ctx.createPattern(tile, 'repeat');
  }

  update(dt) {
    this.t += dt;
    const parallax = this.isMobile ? 0 : PARALLAX;
    const k = 1 - Math.exp(-dt * 2.5);
    this.px += (this.ptx * parallax - this.px) * k;
    this.py += (this.pty * parallax - this.py) * k;
    this.ripples.forEach((r) => (r.age += dt));
    this.ripples = this.ripples.filter((r) => r.age < RIPPLE_LIFE);
    this.dust.forEach((m) => {
      m.y -= m.vy * dt;
      if (m.y < -6) Object.assign(m, this.mote(false));
    });
  }

  renderStatic() {
    this.draw({ t: 14, ox: 0, oy: 0 }, true);
  }

  draw(frame, still) {
    if (!this.w || !this.h) return;
    const { ctx, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drawDepth(frame);
    this.drawContours(frame, still);
    if (!still) this.drawDust(frame);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 0.04;
    ctx.fillStyle = this.grain;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.globalAlpha = 1;
  }

  // Базовый цвет, медленно блуждающее пятно света (цикл 60 с) и виньетка.
  drawDepth(frame) {
    const { ctx, w, h, colors } = this;
    const cycle = (TAU * frame.t) / 60;
    ctx.fillStyle = rgba(colors.bg, 1);
    ctx.fillRect(0, 0, w, h);
    const lx = w * (0.5 + 0.16 * Math.sin(cycle)) + frame.ox * 0.15;
    const ly = h * (0.42 + 0.08 * Math.sin(2 * cycle + 1.1)) + frame.oy * 0.15;
    let g = ctx.createRadialGradient(lx, ly, 0, lx, ly, Math.hypot(w, h) * 0.55);
    g.addColorStop(0, rgba(colors.bgLight, 1));
    g.addColorStop(0.5, rgba(colors.bgLight, 0.35));
    g.addColorStop(1, rgba(colors.bgLight, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    g = ctx.createRadialGradient(
      w / 2,
      h / 2,
      Math.min(w, h) * 0.25,
      w / 2,
      h / 2,
      Math.hypot(w, h) * 0.62,
    );
    g.addColorStop(0, rgba(colors.bgDeep, 0));
    g.addColorStop(1, rgba(colors.bgDeep, 1));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  // Marching squares по двум октавам дрейфующего шума; волны изгибают поле и подкрашивают отрезки
  // изолиний, через которые проходят (цвет + толщина, никогда не ореол).
  drawContours(frame, still) {
    const { ctx, w, h, colors } = this;
    const cs = this.isMobile ? 26 : 16;
    const margin = cs * 2;
    const ox = frame.ox * 0.4;
    const oy = frame.oy * 0.4;
    const x0 = -margin;
    const y0 = -margin;
    const cols = Math.ceil((w + 2 * margin) / cs) + 1;
    const rows = Math.ceil((h + 2 * margin) / cs) + 1;
    if (!this.field || this.field.length < cols * rows) this.field = new Float32Array(cols * rows);
    const field = this.field;
    const tc = frame.t * CONTOUR_SPEED;
    const fq = 1 / 460;
    const z = tc * 0.022;
    const drift = tc * 4;

    const rings = still
      ? []
      : this.ripples.map((r) => {
          const q = r.age / RIPPLE_LIFE;
          return {
            x: r.x - ox,
            y: r.y - oy,
            R: (1 - (1 - q) ** 3) * Math.min(640, Math.max(w, h) * 0.45),
            fade: Math.min(1, q * 6) * (1 - q) ** 1.4,
          };
        });

    for (let j = 0; j < rows; j++) {
      const py = y0 + j * cs;
      for (let i = 0; i < cols; i++) {
        const px = x0 + i * cs;
        let v =
          (noise3((px + drift) * fq, py * fq, z) +
            0.5 * noise3(px * fq * 2.1 + 11.3, (py - drift * 0.6) * fq * 2.1, z * 1.4 + 5.7)) /
          1.5;
        for (const r of rings) {
          const dd = Math.hypot(px - r.x, py - r.y) - r.R;
          v += 0.1 * r.fade * Math.exp(-(dd * dd) / 2900);
        }
        field[j * cols + i] = v;
      }
    }

    ctx.save();
    ctx.translate(ox, oy);
    ctx.lineWidth = 1;
    const lit = rings.length ? [new Path2D(), new Path2D(), new Path2D(), new Path2D()] : null;
    let path;
    const segment = (x1, y1, x2, y2) => {
      if (lit) {
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        let intensity = 0;
        for (const r of rings) {
          const dd = Math.hypot(mx - r.x, my - r.y) - r.R;
          intensity = Math.max(intensity, r.fade * Math.exp(-(dd * dd) / 1570));
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
        const py = y0 + j * cs;
        const r0 = j * cols;
        const r1 = r0 + cols;
        for (let i = 0; i < cols - 1; i++) {
          const a = field[r0 + i];
          const b = field[r0 + i + 1];
          const c = field[r1 + i + 1];
          const d = field[r1 + i];
          const idx =
            (a > level ? 8 : 0) | (b > level ? 4 : 0) | (c > level ? 2 : 0) | (d > level ? 1 : 0);
          if (idx === 0 || idx === 15) continue;
          const px = x0 + i * cs;
          const tx = px + (cs * (level - a)) / (b - a);
          const ty = py;
          const rx = px + cs;
          const ry = py + (cs * (level - b)) / (c - b);
          const bx = px + (cs * (level - d)) / (c - d);
          const by = py + cs;
          const lx = px;
          const ly = py + (cs * (level - a)) / (d - a);
          const above = (a + b + c + d) / 4 > level;
          switch (idx) {
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
      ctx.strokeStyle = rgba(colors[key], alpha);
      ctx.stroke(path);
    }

    if (lit) {
      lit.forEach((bucket, b) => {
        const intensity = (b + 0.5) / 4;
        ctx.lineWidth = 1 + 0.5 * intensity;
        ctx.strokeStyle = rgba(
          mix(colors.pulse, colors.pulsePeak, intensity),
          0.35 + 0.6 * intensity,
        );
        ctx.stroke(bucket);
      });
      ctx.lineWidth = 1;
      rings.forEach((r) => {
        ctx.beginPath();
        ctx.arc(r.x, r.y, Math.max(0, r.R), 0, TAU);
        ctx.strokeStyle = rgba(colors.pulse, 0.2 * r.fade);
        ctx.stroke();
      });
    }
    ctx.restore();
  }

  drawDust(frame) {
    const { ctx, h, colors } = this;
    this.dust.forEach((m) => {
      const edge = smooth(m.y / (h * 0.18)) * smooth((h + 6 - m.y) / (h * 0.1));
      if (edge <= 0) return;
      ctx.fillStyle = rgba(colors.dust, m.a * edge);
      ctx.beginPath();
      ctx.arc(m.x + Math.sin(this.t * m.f + m.ph) * m.amp + frame.ox, m.y + frame.oy, m.r, 0, TAU);
      ctx.fill();
    });
  }
}
