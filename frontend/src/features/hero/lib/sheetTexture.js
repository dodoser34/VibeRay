import { MOODS } from '@/shared/config/moods';
import { cssVar } from '@/shared/lib/theme/cssVar';
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
  const latticeValue = (x, y) =>
    table[(((x % LATTICE) + LATTICE) % LATTICE) * LATTICE + (((y % LATTICE) + LATTICE) % LATTICE)];
  // (x, y) в единицах; возвращает −1…1
  return (x, y) => {
    const latticeX = (x / TILE) * LATTICE;
    const latticeY = (y / TILE) * LATTICE;
    const x0 = Math.floor(latticeX);
    const y0 = Math.floor(latticeY);
    const fadeX = smooth(latticeX - x0);
    const fadeY = smooth(latticeY - y0);
    const corner00 = latticeValue(x0, y0);
    const corner10 = latticeValue(x0 + 1, y0);
    const corner01 = latticeValue(x0, y0 + 1);
    const corner11 = latticeValue(x0 + 1, y0 + 1);
    return (
      (corner00 +
        (corner10 - corner00) * fadeX +
        (corner01 - corner00) * fadeY +
        (corner00 - corner10 - corner01 + corner11) * fadeX * fadeY) *
        2 -
      1
    );
  };
}

function createWarp(seed) {
  const nx = periodicNoise(seed);
  const ny = periodicNoise(seed + 7);
  return (x, y) => [x + nx(x, y) * WARP, y + ny(x, y) * WARP];
}

function strokeLine(context, points) {
  context.beginPath();
  points.forEach(([x, y], i) => (i ? context.lineTo(x, y) : context.moveTo(x, y)));
  context.stroke();
}

// Горизонтальные и вертикальные улицы на слегка искривлённой сетке; проспекты толще и непрерывны, у
// второстепенных улиц часть отрезков пропадает (поквартально), как в настоящем городе.
function drawStreets(context, warp, rand) {
  const minor = cssVar('--bg-contour');
  const major = cssVar('--color-glass-border');
  context.lineCap = 'round';
  context.lineJoin = 'round';
  for (let streetIndex = 0; streetIndex < TILE / STREET; streetIndex++) {
    const offset = STREET / 2 + streetIndex * STREET;
    const avenue = streetIndex % AVENUE_EVERY === 0;
    context.strokeStyle = avenue ? major : minor;
    context.lineWidth = avenue ? 2.2 : 1;
    [(t) => warp(t, offset), (t) => warp(offset, t)].forEach((pointAt) => {
      // один отрезок на квартал, от одной поперечной улицы до следующей
      for (let blockIndex = 0; blockIndex <= TILE / STREET; blockIndex++) {
        if (!avenue && rand() < MISSING) continue;
        const from = Math.max(0, STREET / 2 + (blockIndex - 1) * STREET);
        const until = Math.min(TILE, STREET / 2 + blockIndex * STREET);
        if (until <= from) continue;
        const points = [];
        for (let t = from; t < until; t += STEP) points.push(pointAt(t));
        points.push(pointAt(until));
        if (points.length > 1) strokeLine(context, points);
      }
    });
  }
}

// Два диагональных бульвара; каждый разрезается там, где выходит за тайл, чтобы узор оставался
// бесшовным.
function drawBoulevards(context) {
  context.strokeStyle = cssVar('--color-glass-border');
  context.lineWidth = 1.6;
  context.setLineDash([10, 6]);
  [120, 360].forEach((position) => {
    strokeLine(context, [
      [0, position],
      [TILE - position, TILE],
    ]);
    strokeLine(context, [
      [TILE - position, 0],
      [TILE, position],
    ]);
  });
  context.setLineDash([]);
}

function drawSquares(context, warp) {
  context.strokeStyle = cssVar('--color-glass-border');
  context.fillStyle = cssVar('--color-layer-front');
  context.lineWidth = 1.6;
  const avenues = [];
  for (let k = 0; k < TILE / STREET; k += AVENUE_EVERY) avenues.push(STREET / 2 + k * STREET);
  avenues.forEach((ax) =>
    avenues.forEach((ay) => {
      const [x, y] = warp(ax, ay);
      context.beginPath();
      context.arc(x, y, 10, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.beginPath();
      context.arc(x, y, 3.5, 0, Math.PI * 2);
      context.stroke();
    }),
  );
}

function drawParks(context, rand) {
  context.fillStyle = cssVar('--color-accent');
  for (let k = 0; k < PARKS; k++) {
    const x = STREET + Math.floor(rand() * (TILE / STREET - 2)) * STREET;
    const y = STREET + Math.floor(rand() * (TILE / STREET - 2)) * STREET;
    context.globalAlpha = 0.07;
    context.beginPath();
    context.ellipse(x, y, 18 + rand() * 8, 13 + rand() * 6, rand() * Math.PI, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;
}

// Жители: крошечные точки цветами настроения, как люди на карте.
function drawResidents(context, rand) {
  const colors = MOODS.map((mood) => cssVar(mood.colorVar));
  for (let k = 0; k < RESIDENTS; k++) {
    context.globalAlpha = 0.28 + rand() * 0.2;
    context.fillStyle = colors[Math.floor(rand() * colors.length)];
    context.beginPath();
    context.arc(rand() * TILE, rand() * TILE, 1.4, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;
}

function drawGrain(context, rand) {
  const light = cssVar('--color-text');
  const dark = cssVar('--color-bg-deep');
  for (let k = 0; k < 9000; k++) {
    context.globalAlpha = 0.03 + rand() * 0.05;
    context.fillStyle = rand() > 0.5 ? light : dark;
    context.fillRect(rand() * TILE, rand() * TILE, 0.7, 0.7);
  }
  context.globalAlpha = 1;
}

// Возвращает object URL тайла (фон прозрачный: сквозь него виден цвет листа). Вызывающий код
// освобождает его через URL.revokeObjectURL, когда текстура больше не показывается.
export function createSheetTexture(seed = 20260927) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = TILE * PIXEL_SCALE;
  const context = canvas.getContext('2d');
  context.scale(PIXEL_SCALE, PIXEL_SCALE);
  const rand = createRandom(seed + 1);
  const warp = createWarp(seed);
  drawParks(context, rand);
  drawStreets(context, warp, rand);
  drawBoulevards(context);
  drawSquares(context, warp);
  drawResidents(context, rand);
  drawGrain(context, rand);
  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : null), 'image/png'),
  );
}
