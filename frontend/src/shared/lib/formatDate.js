import common from '@/texts/common.json';
import { format } from './format';

const timeFormat = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });
const dateFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' });
const longDateFormat = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'short',
  day: 'numeric',
  month: 'long',
});
const fullDateFormat = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const weekdayFormat = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' });
const monthFormat = new Intl.DateTimeFormat('ru-RU', { month: 'short' });
const monthNameFormat = new Intl.DateTimeFormat('ru-RU', { month: 'long' });

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

export function formatTime(date) {
  return timeFormat.format(new Date(date));
}

// «12 сент.»
export function formatDate(date) {
  return dateFormat.format(new Date(date));
}

// «Пт, 12 сентября»
export function formatLongDate(date) {
  return capitalize(longDateFormat.format(new Date(date)));
}

// «1 октября 2025 г.»
export function formatFullDate(date) {
  return fullDateFormat.format(new Date(date));
}

// «пт»
export function formatWeekday(date) {
  return weekdayFormat.format(new Date(date));
}

// «сент.»
export function formatMonth(date) {
  return monthFormat.format(new Date(date));
}

// «Сентябрь 2026»
export function formatMonthYear(date) {
  const value = new Date(date);
  return `${capitalize(monthNameFormat.format(value))} ${value.getFullYear()}`;
}

export function formatRelative(date) {
  const minutes = Math.round((Date.now() - new Date(date).getTime()) / 60_000);
  if (minutes < 1) return common.time.justNow;
  if (minutes < 60) return format(common.time.minutesAgo, { minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return format(common.time.hoursAgo, { hours });
  return formatDate(date);
}
