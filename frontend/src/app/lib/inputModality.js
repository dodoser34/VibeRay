// В режим «keyboard» переключают только клавиши навигации: ввод текста и Shift фокус не двигают.
const NAVIGATION_KEYS = new Set([
  'Tab',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
]);

// Рамка фокуса нужна тем, кто ходит клавиатурой, но некоторые браузеры показывают :focus-visible
// и после клика мышью. Атрибут data-input="pointer|keyboard" на <html> запоминает, как
// пользователь перемещается, и global.css прячет рамку в режиме «pointer».
export function trackInputModality() {
  const root = document.documentElement;
  const set = (mode) => {
    if (root.dataset.input !== mode) root.dataset.input = mode;
  };
  window.addEventListener('pointerdown', () => set('pointer'), true);
  window.addEventListener(
    'keydown',
    (event) => {
      if (NAVIGATION_KEYS.has(event.key)) set('keyboard');
    },
    true,
  );
}
