import { MOOD_SCALE, NO_DATA_COLOR_VAR } from '@/shared/config/moods';

// Цвет настроения района для 2D-карт (SVG, CSS) без three.js: смесь двух соседних токенов шкалы,
// как colorForScore в 3D-сцене. Строка с var(), поэтому цвет сам следует за темой.
export function moodFill(aggregate) {
  if (!aggregate || aggregate.insufficient_data) return `var(${NO_DATA_COLOR_VAR})`;
  const score = Math.min(2, Math.max(-2, aggregate.score));
  const upper = MOOD_SCALE.findIndex((step) => score <= step.score);
  if (upper <= 0) return `var(${MOOD_SCALE[Math.max(upper, 0)].colorVar})`;
  const from = MOOD_SCALE[upper - 1];
  const to = MOOD_SCALE[upper];
  const share = Math.round(((score - from.score) / (to.score - from.score)) * 100);
  return `color-mix(in srgb, var(${to.colorVar}) ${share}%, var(${from.colorVar}))`;
}
