// Читает токен дизайна с <html> (текущая тема), чтобы Three.js-сцена и canvas использовали те же
// цвета, что и CSS.
const cache = new Map();

export function cssVar(name) {
  if (!cache.has(name)) {
    cache.set(name, getComputedStyle(document.documentElement).getPropertyValue(name).trim());
  }
  return cache.get(name);
}

// Тема сменилась — токены надо читать заново (shared/lib/theme.js).
export function clearCssVarCache() {
  cache.clear();
}
