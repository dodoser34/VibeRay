import { readValue, writeValue } from '@/shared/lib/localFlag';

const KEY = 'viberay:city';
const SLUG = /^[a-z0-9-]+$/;
export const DEFAULT_CITY = 'kostanay';

// Город, который посетитель открывал на карте последним: туда ведут вкладка «Карта» и меню.
export function lastCity() {
  const slug = readValue(KEY);
  return slug && SLUG.test(slug) ? slug : DEFAULT_CITY;
}

export function rememberCity(slug) {
  if (SLUG.test(slug)) writeValue(KEY, slug);
}
