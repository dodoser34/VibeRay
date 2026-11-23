import { COARSE_POINTER, tierFor } from './breakpoints';

// Качество WebGL-сцен и canvas-эффектов под устройство. Телефоны выглядят так же, но с меньшим
// числом пикселей, частиц и людей; 2K/4K/8K остаются чёткими, но кадр не превышает бюджет пикселей
// (4K-холст при devicePixelRatio 2 — это 33 млн пикселей на кадр). Значение зависит от окна: сцены
// перечитывают его при ресайзе и при переезде окна на монитор с другой плотностью (watchPixelRatio).
export function renderQuality(width = window.innerWidth) {
  const tier = tierFor(width);
  const mobile = tier === 'mobile';
  const tablet = tier === 'tablet';
  const coarse = window.matchMedia(COARSE_POINTER).matches;
  const cores = navigator.hardwareConcurrency ?? 8;
  const memory = navigator.deviceMemory ?? 8;
  const lowPower = cores <= 4 || memory <= 4;
  return {
    tier,
    maxPixelRatio: mobile ? 1.5 : tablet ? 1.75 : 2,
    maxPixels: 8_300_000, // примерно один кадр 4K
    antialias: !(mobile && lowPower),
    particles: mobile ? 0.45 : tablet ? 0.7 : 1,
    detail: mobile ? (lowPower ? 0.45 : 0.6) : tablet ? 0.8 : 1,
    parallax: !coarse && !mobile,
  };
}

// devicePixelRatio для холста этого размера в пределах качества. Бюджет пикселей важнее чёткости:
// на 8K-мониторе (33 млн CSS-пикселей) кадр рисуется в половинной плотности и растягивается
// браузером — как 4K. `min` — нижний предел, чтобы небольшой холст не стал мыльным.
export function pixelRatioFor(
  width,
  height,
  quality = renderQuality(),
  { maxPixels = quality.maxPixels, min = 0.5 } = {},
) {
  const device = Math.min(window.devicePixelRatio || 1, quality.maxPixelRatio);
  const budget = Math.sqrt(maxPixels / Math.max(1, width * height));
  return Math.max(Math.min(min, device), Math.min(device, budget));
}

// Окно переехало на монитор с другой плотностью пикселей (размер в CSS-пикселях тот же, поэтому
// ResizeObserver молчит) — холстам нужно пересчитать плотность. Возвращает отписку.
export function watchPixelRatio(callback) {
  let query = null;
  const listen = () => {
    query = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    query.addEventListener('change', onChange, { once: true });
  };
  const onChange = () => {
    listen();
    callback();
  };
  listen();
  return () => query.removeEventListener('change', onChange);
}
