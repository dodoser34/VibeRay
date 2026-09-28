import { getLanguage } from './language';

// Формы для чисел 1 / 2 / 5 из src/texts: plural(5, ['отметка', 'отметки', 'отметок']) → 'отметок'.
// В английских текстах формы те же по месту: ['mark', 'marks', 'marks'].
export function plural(count, [one, few, many]) {
  if (getLanguage() === 'en') return Math.abs(count) === 1 ? one : many;
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
