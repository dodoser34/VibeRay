import { getLocale } from './language';

const integerFormats = new Map();

// 14000 → «14 000»
export function formatNumber(value) {
  const locale = getLocale();
  if (!integerFormats.has(locale)) {
    integerFormats.set(locale, new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }));
  }
  return integerFormats.get(locale).format(Math.round(value));
}

// Оценки настроения и их изменения: «+1.2», «−0.4», «0.0».
export function formatSigned(value, digits = 1) {
  const text = Math.abs(value).toFixed(digits);
  if (Number(text) === 0) return text;
  return `${value > 0 ? '+' : '−'}${text}`;
}

export function percentOf(part, total) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}
