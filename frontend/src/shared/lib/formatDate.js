import common from '@/texts/ru/common.json';
import { format } from './format';
import { getLocale } from './language';

const OPTIONS = {
  time: { hour: '2-digit', minute: '2-digit' },
  date: { day: 'numeric', month: 'short' },
  longDate: { weekday: 'short', day: 'numeric', month: 'long' },
  fullDate: { day: 'numeric', month: 'long', year: 'numeric' },
  weekday: { weekday: 'short' },
  month: { month: 'short' },
  monthName: { month: 'long' },
};
const cache = new Map();

// Форматтеры — на языке интерфейса в момент вызова (язык можно сменить без перезагрузки).
function formatter(kind) {
  const key = `${getLocale()}:${kind}`;
  if (!cache.has(key)) cache.set(key, new Intl.DateTimeFormat(getLocale(), OPTIONS[kind]));
  return cache.get(key);
}

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

export function formatTime(date) {
  return formatter('time').format(new Date(date));
}

// «12 сент.»
export function formatDate(date) {
  return formatter('date').format(new Date(date));
}

// «Пт, 12 сентября»
export function formatLongDate(date) {
  return capitalize(formatter('longDate').format(new Date(date)));
}

// «1 октября 2025 г.»
export function formatFullDate(date) {
  return formatter('fullDate').format(new Date(date));
}

// «пт»
export function formatWeekday(date) {
  return formatter('weekday').format(new Date(date));
}

// «сент.»
export function formatMonth(date) {
  return formatter('month').format(new Date(date));
}

// «Сентябрь 2026»
export function formatMonthYear(date) {
  const value = new Date(date);
  return `${capitalize(formatter('monthName').format(value))} ${value.getFullYear()}`;
}

export function formatRelative(date) {
  const minutes = Math.round((Date.now() - new Date(date).getTime()) / 60_000);
  if (minutes < 1) return common.time.justNow;
  if (minutes < 60) return format(common.time.minutesAgo, { minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return format(common.time.hoursAgo, { hours });
  return formatDate(date);
}
