const cache = new Map();

// Читает токен дизайна, чтобы Three.js-сцена использовала те же цвета, что и CSS.
export function cssVar(name) {
  if (!cache.has(name)) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    cache.set(name, value);
  }
  return cache.get(name);
}
