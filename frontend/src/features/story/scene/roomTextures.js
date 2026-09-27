import * as THREE from 'three';
import { cssVar } from '@/shared/lib/cssVar';

function seeded(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function canvasTexture(width, height, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// Ночной город за окном: небо с бледной луной и несколькими звёздами, три слоя зданий (дальние в
// дымке), горящие окна и огни машин вдоль улицы. Без свечения — плоские цвета.
export function nightCityTexture() {
  return canvasTexture(1400, 875, (ctx, W, H) => {
    const rnd = seeded(7);
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, cssVar('--color-bg-deep'));
    sky.addColorStop(0.7, cssVar('--story-sky'));
    sky.addColorStop(1, cssVar('--story-sky'));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = cssVar('--color-text');
    for (let i = 0; i < 60; i++) {
      ctx.globalAlpha = 0.15 + rnd() * 0.35;
      ctx.fillRect(rnd() * W, rnd() * H * 0.45, 1.6, 1.6);
    }
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(W * 0.8, H * 0.16, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    const layers = [
      { top: 0.42, min: 0.12, max: 0.3, alpha: 0.45, lit: 0.08, win: 5 },
      { top: 0.5, min: 0.15, max: 0.38, alpha: 0.75, lit: 0.13, win: 7 },
      { top: 0.6, min: 0.2, max: 0.42, alpha: 1, lit: 0.18, win: 9 },
    ];
    layers.forEach((layer) => {
      for (let x = -20; x < W;) {
        const w = 50 + rnd() * 120;
        const h = H * (layer.min + rnd() * (layer.max - layer.min));
        const y = H * layer.top + (H * 0.4 - h) * 0.4;
        ctx.globalAlpha = layer.alpha;
        ctx.fillStyle = cssVar('--story-skyline');
        ctx.fillRect(x, y, w, H - y);
        if (rnd() < 0.3) ctx.fillRect(x + w * 0.4, y - 18, 3, 18); // антенна
        ctx.fillStyle = cssVar('--story-window-light');
        const step = layer.win * 2.4;
        for (let wy = y + 10; wy < H - 60; wy += step) {
          for (let wx = x + 6; wx < x + w - 8; wx += step * 0.8) {
            if (rnd() < layer.lit) {
              ctx.globalAlpha = layer.alpha * (0.35 + rnd() * 0.5);
              ctx.fillRect(wx, wy, layer.win * 0.7, layer.win);
            }
          }
        }
        x += w + 2 + rnd() * 10;
      }
    });

    // улица с цепочкой фар и задних огней
    ctx.globalAlpha = 1;
    ctx.fillStyle = cssVar('--color-bg-deep');
    ctx.fillRect(0, H - 60, W, 60);
    for (let i = 0; i < 26; i++) {
      const x = rnd() * W;
      const lane = rnd() < 0.5;
      ctx.fillStyle = cssVar(lane ? '--story-window-light' : '--story-tail-light');
      ctx.globalAlpha = 0.5 + rnd() * 0.4;
      ctx.fillRect(x, H - (lane ? 40 : 24), 5, 3);
      ctx.fillRect(x + 9, H - (lane ? 40 : 24), 5, 3);
    }
    ctx.globalAlpha = 1;
  });
}

// Бумажная карта города на стене: повёрнутая сетка улиц и река — будущая идея.
export function wallMapTexture() {
  return canvasTexture(512, 360, (ctx, W, H) => {
    const rnd = seeded(31);
    ctx.fillStyle = cssVar('--story-paper');
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(Math.PI / 4);
    ctx.strokeStyle = cssVar('--story-desk');
    for (let i = -12; i <= 12; i++) {
      ctx.globalAlpha = i % 4 === 0 ? 0.7 : 0.3;
      ctx.lineWidth = i % 4 === 0 ? 3 : 1.2;
      ctx.beginPath();
      ctx.moveTo(i * 22, -400);
      ctx.lineTo(i * 22, 400);
      ctx.moveTo(-400, i * 22);
      ctx.lineTo(400, i * 22);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = cssVar('--color-river');
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(W * 0.8, 0);
    ctx.bezierCurveTo(W * 0.6, H * 0.3, W * 0.95, H * 0.6, W * 0.7, H);
    ctx.stroke();
    // несколько пометок от руки: кто-то уже обводит места
    ctx.strokeStyle = cssVar('--mood-angry');
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(W * (0.2 + rnd() * 0.4), H * (0.2 + rnd() * 0.6), 14 + rnd() * 10, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
}

// Текстура дерева для столешницы: длинные слегка волнистые полосы оттенков цвета стола.
export function woodTexture() {
  return canvasTexture(1024, 512, (ctx, W, H) => {
    const rnd = seeded(11);
    const base = new THREE.Color(cssVar('--story-desk'));
    ctx.fillStyle = `#${base.getHexString()}`;
    ctx.fillRect(0, 0, W, H);
    const light = base.clone().lerp(new THREE.Color(cssVar('--story-paper')), 0.12);
    const dark = base.clone().lerp(new THREE.Color(cssVar('--story-wall')), 0.35);
    for (let i = 0; i < 140; i++) {
      const y0 = rnd() * H;
      ctx.strokeStyle = `#${(rnd() < 0.5 ? light : dark).getHexString()}`;
      ctx.globalAlpha = 0.25 + rnd() * 0.45;
      ctx.lineWidth = 0.6 + rnd() * 2.2;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 16) {
        const y = y0 + Math.sin(x / (90 + rnd() * 40) + i) * 3 + Math.sin(x / 400 + i * 0.3) * 6;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
}
