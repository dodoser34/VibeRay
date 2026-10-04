import { clearCssVarCache } from './cssVar';
import { createListeners } from './listeners';
import { readChoice, writeValue } from './localFlag';

// Тема оформления: тёмная (по умолчанию) или светлая. Цвета — токены в src/styles/themes/; тема —
// атрибут data-theme на <html>. Модуль импортируется в main.jsx до отрисовки, чтобы страница сразу
// открылась в нужной теме, без вспышки. Смена на лету — applyTheme(): CSS перекрашивается сам, а
// 3D-сцены и canvas подписаны (useTheme / subscribeTheme) и перечитывают токены.

export const THEMES = ['dark', 'light'];
const STORAGE_KEY = 'viberay.theme';

// Сохранённый выбор, иначе — по настройке системы.
function detect() {
  const saved = readChoice(STORAGE_KEY, THEMES);
  if (saved) return saved;
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function paint(next) {
  document.documentElement.dataset.theme = next;
  // Цвет полосы браузера на телефонах — фон темы. Читается после того, как подключатся стили темы
  // (при загрузке этот модуль выполняется раньше них).
  setTimeout(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    const color = getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim();
    if (meta && color) meta.content = color;
  });
}

let theme = detect();
paint(theme);

const listeners = createListeners();

export function getTheme() {
  return theme;
}

export const subscribeTheme = listeners.subscribe;

export function applyTheme(next) {
  if (next === theme || !THEMES.includes(next)) return;
  theme = next;
  clearCssVarCache();
  paint(next);
  writeValue(STORAGE_KEY, next);
  listeners.notify();
}
