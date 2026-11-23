import { useSyncExternalStore } from 'react';

// Во сколько раз интерфейс крупнее базовых 16 px. Корневой шрифт считает одна формула от размеров
// окна (adaptations/scale.css): на 2K/4K и повёрнутых мониторах он растёт, в невысоких окнах —
// уменьшается, и всё в rem меняется вместе с ним. Код, который рисует в пикселях (SVG-графики,
// canvas, подписи 3D), умножает размеры на этот множитель, чтобы сохранить пропорции.
export function rootScale() {
  return parseFloat(getComputedStyle(document.documentElement).fontSize) / 16 || 1;
}

// Масштаб меняется плавно при любом ресайзе, в том числе только по высоте, — подписчики узнают об
// этом раз в кадр и только при заметном изменении (больше 0,5 %).
const THRESHOLD = 0.005;
const listeners = new Set();
// Читается лениво: модуль может загрузиться раньше, чем стили adaptations/scale.css.
let current = null;
let frame = 0;

function check() {
  frame = 0;
  const next = rootScale();
  if (current !== null && Math.abs(next - current) / current <= THRESHOLD) return;
  current = next;
  listeners.forEach((listener) => listener(current));
}

function schedule() {
  if (!frame) frame = requestAnimationFrame(check);
}

export function subscribeRootScale(listener) {
  if (!listeners.size) {
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size) return;
    window.removeEventListener('resize', schedule);
    window.visualViewport?.removeEventListener('resize', schedule);
  };
}

// Компонент перерисовывается, когда масштаб интерфейса заметно изменился.
export function useRootScale() {
  return useSyncExternalStore(
    subscribeRootScale,
    () => (current ??= rootScale()),
    () => 1,
  );
}
