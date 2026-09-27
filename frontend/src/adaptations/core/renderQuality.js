import { COARSE_POINTER, tierFor } from './breakpoints';

// Качество WebGL-сцен и canvas-эффектов под устройство. Телефоны выглядят так же, но с меньшим
// числом пикселей, частиц и людей; 2K/4K остаются чёткими, но кадр не превышает бюджет пикселей
// (4K-холст при devicePixelRatio 2 — это 33 млн пикселей на кадр).
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

// devicePixelRatio для холста этого размера в пределах качества. Ниже `min` — только для мягких
// эффектов (фон сайта может рисовать 4K-экран в 0.75, браузер растянет).
export function pixelRatioFor(
  width,
  height,
  quality = renderQuality(),
  { maxPixels = quality.maxPixels, min = 1 } = {},
) {
  const device = Math.min(window.devicePixelRatio || 1, quality.maxPixelRatio);
  const budget = Math.sqrt(maxPixels / Math.max(1, width * height));
  return Math.max(Math.min(min, device), Math.min(device, budget));
}
