// Разница оценок меньше этой читается как «без изменений» (оценки в диапазоне −2…+2).
export const SAME_SCORE = 0.1;

// Направление изменения оценки: 'up', 'down' или 'flat'; null — данных нет.
export function trendDirection(delta) {
  if (delta === null || delta === undefined) return null;
  if (Math.abs(delta) < SAME_SCORE) return 'flat';
  return delta > 0 ? 'up' : 'down';
}
