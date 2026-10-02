import * as THREE from 'three';
import { cssVar } from '@/shared/lib/cssVar';
import { getLanguage } from '@/shared/lib/language';
import about from '@/texts/ru/about.json';

function seeded(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// Шрифт уменьшается, пока строка не влезет в max пикселей: надписи не выходят за край холста ни на
// одном языке.
function fitFont(ctx, text, weight, size, family, max) {
  let px = size;
  ctx.font = `${weight} ${px}px ${family}`;
  while (ctx.measureText(text).width > max && px > 10) {
    px -= 2;
    ctx.font = `${weight} ${px}px ${family}`;
  }
}

function canvasTexture(width, height, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  paint(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  // Текстуры с надписями перерисовываются при смене языка (RoomSet.update).
  texture.userData.repaint = () => {
    ctx.clearRect(0, 0, width, height);
    paint(ctx, width, height);
    texture.needsUpdate = true;
  };
  return texture;
}

// Небо над улицей за окном. UV плоскости неба в модели покрывают только видимую из окна часть
// (верх холста — высоко над крышами, низ — горизонт), поэтому облака, звёзды и луна рисуются в
// средней полосе холста. Днём — облака, ночью — звёзды и бледная луна; без свечения.
export function skyTexture({ daylight }) {
  return canvasTexture(2048, 1024, (ctx, W, H) => {
    const rnd = seeded(daylight ? 3 : 7);
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, cssVar('--story-sky-top'));
    sky.addColorStop(0.85, cssVar('--story-sky'));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    if (daylight) {
      ctx.fillStyle = cssVar('--story-cloud');
      for (let i = 0; i < 16; i++) {
        const cx = W * (0.25 + rnd() * 0.55);
        const cy = H * (0.18 + rnd() * 0.5);
        const size = 30 + rnd() * 50;
        ctx.globalAlpha = 0.35 + rnd() * 0.35;
        for (let k = 0; k < 5; k++) {
          ctx.beginPath();
          ctx.ellipse(
            cx + (k - 2) * size * 0.7,
            cy - (k % 2) * size * 0.25,
            size,
            size * 0.42,
            0,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
      }
    } else {
      ctx.fillStyle = cssVar('--color-text');
      for (let i = 0; i < 260; i++) {
        ctx.globalAlpha = 0.2 + rnd() * 0.5;
        const r = rnd() < 0.1 ? 2.2 : 1.3;
        ctx.fillRect(W * (0.2 + rnd() * 0.6), H * rnd() * 0.65, r, r);
      }
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = cssVar('--story-paper');
      ctx.beginPath();
      ctx.arc(W * 0.47, H * 0.4, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = cssVar('--story-sky');
      [
        [-8, -6, 7],
        [9, 5, 5],
        [-2, 11, 4],
      ].forEach(([dx, dy, r]) => {
        ctx.beginPath();
        ctx.arc(W * 0.47 + dx, H * 0.4 + dy, r, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    ctx.globalAlpha = 1;
  });
}

// Корешки книг на полке, стилизованные по изданиям (без обложек и логотипов): манга «Атака на
// титанов» (Азбука) — светлый корешок, тёмная плашка с номером тома; Стивен Кинг (АСТ) — тёмный
// корешок, имя автора и название цветом книги. Русские корешки читаются снизу вверх, английские —
// сверху вниз.
const SPINES = {
  titan: { background: '--story-spine-titan', ink: '--story-monitor', band: '--story-monitor' },
  it: { background: '--story-spine-king', ink: '--story-paper', accent: '--mood-angry' },
  'green-mile': { background: '--story-spine-king', ink: '--story-paper', accent: '--story-plant' },
  shawshank: { background: '--story-spine-king', ink: '--story-paper', accent: '--color-river' },
};
const KING_TITLES = { it: 'it', 'green-mile': 'greenMile', shawshank: 'shawshank' };

export function spineTexture(key) {
  const [series, volume] = key.startsWith('titan-') ? ['titan', key.slice(6)] : [key, null];
  const style = SPINES[series];
  return canvasTexture(96, 736, (ctx, W, H) => {
    const shelf = about.room.shelf;
    const display = cssVar('--font-display');
    const body = cssVar('--font-body');
    ctx.fillStyle = cssVar(style.background);
    ctx.fillRect(0, 0, W, H);
    // Текст вдоль корешка: поворот холста, x — вдоль книги, y — поперёк.
    const along = (draw) => {
      ctx.save();
      if (getLanguage() === 'ru') {
        ctx.translate(0, H);
        ctx.rotate(-Math.PI / 2);
      } else {
        ctx.translate(W, 0);
        ctx.rotate(Math.PI / 2);
      }
      draw(H, W);
      ctx.restore();
    };
    ctx.textBaseline = 'middle';
    if (volume) {
      ctx.fillStyle = cssVar(style.band);
      ctx.fillRect(0, 0, W, 120);
      ctx.fillStyle = cssVar(style.background);
      ctx.font = `700 52px ${display}`;
      ctx.textAlign = 'center';
      ctx.fillText(volume, W / 2, 62);
      along((L, T) => {
        const ru = getLanguage() === 'ru';
        ctx.fillStyle = cssVar(style.ink);
        ctx.textAlign = ru ? 'right' : 'left';
        fitFont(ctx, shelf.titan.toUpperCase(), 700, 40, display, 430);
        ctx.fillText(shelf.titan.toUpperCase(), ru ? L - 150 : 150, T / 2);
        ctx.textAlign = ru ? 'left' : 'right';
        ctx.font = `600 22px ${body}`;
        ctx.globalAlpha = 0.75;
        ctx.fillText(shelf.isayama, ru ? 40 : L - 40, T / 2);
        ctx.globalAlpha = 1;
      });
      return;
    }
    // Имя автора — у верха книги, название — ниже, цветом книги.
    along((L, T) => {
      const ru = getLanguage() === 'ru';
      ctx.fillStyle = cssVar(style.ink);
      ctx.textAlign = ru ? 'right' : 'left';
      ctx.font = `600 24px ${body}`;
      ctx.fillText(shelf.king.toUpperCase(), ru ? L - 40 : 40, T / 2);
      ctx.fillStyle = cssVar(style.accent);
      ctx.textAlign = ru ? 'left' : 'right';
      const title = shelf[KING_TITLES[series]].toUpperCase();
      fitFont(ctx, title, 700, 44, display, L - 300);
      ctx.fillText(title, ru ? 40 : L - 40, T / 2);
    });
  });
}

// Экран телефона на столе. Ночью он горит: экран блокировки с крупным временем и датой (светлый
// текст на тёмном, без свечения). Днём экран погашен. Верх холста — верх телефона (к окну).
export function phoneTexture({ daylight }) {
  return canvasTexture(288, 608, (ctx, W, H) => {
    if (daylight) {
      const off = ctx.createLinearGradient(0, 0, W, H);
      off.addColorStop(0, cssVar('--story-monitor'));
      off.addColorStop(0.55, cssVar('--story-glass'));
      off.addColorStop(1, cssVar('--story-monitor'));
      ctx.fillStyle = off;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = cssVar('--story-monitor');
      ctx.globalAlpha = 0.75;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      return;
    }
    const phone = about.room.phone;
    const wallpaper = ctx.createLinearGradient(0, 0, 0, H);
    wallpaper.addColorStop(0, cssVar('--color-bg-raised'));
    wallpaper.addColorStop(1, cssVar('--color-accent'));
    ctx.fillStyle = wallpaper;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = cssVar('--color-bg-deep');
    ctx.globalAlpha = 0.35;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.fillStyle = cssVar('--color-text');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const inner = W - 56;
    fitFont(ctx, phone.date, 500, 22, cssVar('--font-body'), inner);
    ctx.fillText(phone.date, W / 2, 120);
    fitFont(ctx, phone.time, 600, 72, cssVar('--font-display'), inner);
    ctx.fillText(phone.time, W / 2, 205);
    ctx.globalAlpha = 0.7;
    [
      [58, H - 70],
      [W - 58, H - 70],
    ].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 20, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillRect(W / 2 - 46, H - 28, 92, 5);
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
