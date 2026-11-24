import { useSyncExternalStore } from 'react';
import { readValue, writeValue } from '@/shared/lib/localPreferences';

const KEY = 'viberay:moderation-city';
const SLUG = /^[a-z0-9-]+$/;
export const DEFAULT_MODERATION_CITY = 'kostanay';

// Город, с которым работает модератор: очередь, сводка «Город» и карта модератора показывают его.
// Общий для всех разделов модератора (переход между разделами его не сбрасывает) и запоминается
// между визитами.
let current = (() => {
  const saved = readValue(KEY);
  return saved && SLUG.test(saved) ? saved : DEFAULT_MODERATION_CITY;
})();
const listeners = new Set();

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setModerationCity(slug) {
  if (!SLUG.test(slug) || slug === current) return;
  current = slug;
  writeValue(KEY, slug);
  listeners.forEach((listener) => listener());
}

export function useModerationCity() {
  return useSyncExternalStore(subscribe, () => current);
}
