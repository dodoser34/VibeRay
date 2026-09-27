// Рамка фокуса нужна тем, кто ходит клавиатурой. Браузеры по-разному решают, когда нажатой кнопке
// «нужна» рамка (:focus-visible), и некоторые показывают её после клика мышью — зелёная рамка
// вокруг только что нажатой вкладки, периода или заголовка таблицы. <html
// data-input="pointer|keyboard"> запоминает, как пользователь перемещается; global.css прячет рамку
// в режиме «pointer». В «keyboard» переключают только клавиши навигации: ввод текста в поле или
// Shift фокус не двигают.
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
