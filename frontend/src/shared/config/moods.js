import dictionaries from '@/texts/ru/dictionaries.json';
import { withLabels } from './withLabels';

// Коды должны совпадать с backend/app/models/enums.py (Mood).
export const MOODS = withLabels(
  [
    {
      code: 'excellent',
      score: 2,
      colorVar: '--mood-excellent',
    },
    { code: 'good', score: 1, colorVar: '--mood-good' },
    { code: 'normal', score: 0, colorVar: '--mood-normal' },
    { code: 'anxious', score: -1, colorVar: '--mood-anxious' },
    { code: 'bad', score: -1, colorVar: '--mood-bad' },
    { code: 'angry', score: -2, colorVar: '--mood-angry' },
    { code: 'very_bad', score: -2, colorVar: '--mood-very-bad' },
  ],
  dictionaries.moods,
);

export const MOOD_BY_CODE = Object.fromEntries(MOODS.map((mood) => [mood.code, mood]));

// Опорные точки цвета района по его общей оценке (−2…+2).
export const MOOD_SCALE = [
  { score: -2, colorVar: '--mood-very-bad' },
  { score: -1, colorVar: '--mood-bad' },
  { score: 0, colorVar: '--mood-normal' },
  { score: 1, colorVar: '--mood-good' },
  { score: 2, colorVar: '--mood-excellent' },
];

export const NO_DATA_COLOR_VAR = '--mood-none';

export function moodCodeForScore(score) {
  if (score >= 1.5) return 'excellent';
  if (score >= 0.5) return 'good';
  if (score > -0.5) return 'normal';
  if (score > -1.5) return 'bad';
  return 'very_bad';
}
