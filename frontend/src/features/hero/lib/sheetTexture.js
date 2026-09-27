import { MOODS } from '@/shared/config/moods';
import { cssVar } from '@/shared/lib/cssVar';
import { createRandom } from '@/shared/lib/random';

// Текстура переднего листа на главной: спокойный стилизованный план города — плавно изогнутые
// улицы, широкие проспекты, два диагональных бульвара, круглые площади, маленькие зелёные парки,
// россыпь жителей цветами настроения и мелкое зерно. Рисуется один раз в бесшовный тайл (каждая
// кривая переходит через края тайла) и повторяется SVG-паттерном — в кадре ничего не
// перерисовывается.

export const TILE = 480; // размер тайла в единицах viewBox листа
const PIXEL_SCALE = 2; // пикселей тайла на единицу: линии остаются чёткими на retina-экранах
const STREET = 60; // расстояние между улицами
const AVENUE_EVERY = 4; // каждая 4-я улица — проспект
const WARP = 17; // насколько улицы отклоняются от прямой
const MISSING = 0.28; // доля пропущенных отрезков второстепенных улиц, чтобы кварталы были разного размера
const LATTICE = 3; // ячеек шума на тайл
const STEP = 8; // шаг ломаной вдоль улицы
const PARKS = 3;
const RESIDENTS = 70;

// Value noise на решётке, которая повторяется каждые LATTICE ячеек, — поэтому кривые сходятся на
// краях тайла.
function periodicNoise(seed) {
  const rand = createRandom(seed);
  const table = Array.from({ length: LATTICE * LATTICE }, rand);
  const smooth = (t) => t * t * (3 - 2 * t);
  const at = (x, y) =>
    table[(((x % LATTICE) + LATTICE) % LATTICE) * LATTICE + (((y % LATTICE) + LATTICE) % LATTICE)];
  // (x, y) в единицах; возвращает −1…1
  return (x, y) => {
    const fx = (x / TILE) * LATTICE;
    const fy = (y / TILE) * LATTICE;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const u = smooth(fx - x0);
    const v = smooth(fy - y0);
    const a = at(x0, y0);
    const b = at(x0 + 1, y0);
    const c = at(x0, y0 + 1);
    const d = at(x0 + 1, y0 + 1);
    return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
  };
}

function createWarp(seed) {
  const nx = periodicNoise(seed);
  const ny = periodicNoise(seed + 7);
  return (x, y) => [x + nx(x, y) * WARP, y + ny(x, y) * WARP];
}

function strokeLine(ctx, points) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
}

// Горизонтальные и вертикальные улицы на слегка искривлённой сетке; проспекты толще и непрерывны, у
// второстепенных улиц часть отрезков пропадает (поквартально), как в настоящем городе.
function drawStreets(ctx, warp, rand) {
  const minor = cssVar('--bg-contour');
  const major = cssVar('--color-glass-border');
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let k = 0; k < TILE / STREET; k++) {
    const offset = STREET / 2 + k * STREET;
    const avenue = k % AVENUE_EVERY === 0;
    ctx.strokeStyle = avenue ? major : minor;
    ctx.lineWidth = avenue ? 2.2 : 1;
    [(t) => warp(t, offset), (t) => warp(offset, t)].forEach((pointAt) => {
      // один отрезок на квартал, от одной поперечной улицы до следующей
      for (let b = 0; b <= TILE / STREET; b++) {
        if (!avenue && rand() < MISSING) continue;
        const from = Math.max(0, STREET / 2 + (b - 1) * STREET);
        const to = Math.min(TILE, STREET / 2 + b * STREET);
        if (to <= from) continue;
        const points = [];
        for (let t = from; t < to; t += STEP) points.push(pointAt(t));
        points.push(pointAt(to));
        if (points.length > 1) strokeLine(ctx, points);
      }
    });
  }
}

// Два диагональных бульвара; каждый разрезается там, где выходит за тайл, чтобы узор оставался
// бесшовным.
function drawBoulevards(ctx) {
  ctx.strokeStyle = cssVar('--color-glass-border');
  ctx.lineWidth = 1.6;
  ctx.setLineDash([10, 6]);
  [120, 360].forEach((c) => {
    strokeLine(ctx, [
      [0, c],
      [TILE - c, TILE],
    ]);
    strokeLine(ctx, [
      [TILE - c, 0],
      [TILE, c],
    ]);
  });
  ctx.setLineDash([]);
}

function drawSquares(ctx, warp) {
  ctx.strokeStyle = cssVar('--color-glass-border');
  ctx.fillStyle = cssVar('--color-layer-front');
  ctx.lineWidth = 1.6;
  const avenues = [];
  for (let k = 0; k < TILE / STREET; k += AVENUE_EVERY) avenues.push(STREET / 2 + k * STREET);
  avenues.forEach((ax) =>
    avenues.forEach((ay) => {
      const [x, y] = warp(ax, ay);
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.stroke();
    }),
  );
}

function drawParks(ctx, rand) {
  ctx.fillStyle = cssVar('--color-accent');
  for (let k = 0; k < PARKS; k++) {
    const x = STREET + Math.floor(rand() * (TILE / STREET - 2)) * STREET;
    const y = STREET + Math.floor(rand() * (TILE / STREET - 2)) * STREET;
    ctx.globalAlpha = 0.07;
    ctx.beginPath();
    ctx.ellipse(x, y, 18 + rand() * 8, 13 + rand() * 6, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Жители: крошечные точки цветами настроения, как люди на карте.
function drawResidents(ctx, rand) {
  const colors = MOODS.map((mood) => cssVar(mood.colorVar));
  for (let k = 0; k < RESIDENTS; k++) {
    ctx.globalAlpha = 0.28 + rand() * 0.2;
    ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
    ctx.beginPath();
    ctx.arc(rand() * TILE, rand() * TILE, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawGrain(ctx, rand) {
  const light = cssVar('--color-text');
  const dark = cssVar('--color-bg-deep');
  for (let k = 0; k < 9000; k++) {
    ctx.globalAlpha = 0.03 + rand() * 0.05;
    ctx.fillStyle = rand() > 0.5 ? light : dark;
    ctx.fillRect(rand() * TILE, rand() * TILE, 0.7, 0.7);
  }
  ctx.globalAlpha = 1;
}

// Возвращает object URL тайла (фон прозрачный: сквозь него виден цвет листа). Вызывающий код
// освобождает его через URL.revokeObjectURL, когда текстура больше не показывается.
export function createSheetTexture(seed = 20260927) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = TILE * PIXEL_SCALE;
  const ctx = canvas.getContext('2d');
  ctx.scale(PIXEL_SCALE, PIXEL_SCALE);
  const rand = createRandom(seed + 1);
  const warp = createWarp(seed);
  drawParks(ctx, rand);
  drawStreets(ctx, warp, rand);
  drawBoulevards(ctx);
  drawSquares(ctx, warp);
  drawResidents(ctx, rand);
  drawGrain(ctx, rand);
  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : null), 'image/png'),
  );
}
