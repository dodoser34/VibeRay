// Пороги адаптации в CSS-пикселях. Те же числа записаны в медиазапросах adaptations/*/ — CSS не
// умеет их импортировать (см. adaptations/README.md). Отдельных порогов в модулях быть не должно.
//
// Три оси:
//   ширина — уровни устройства:
//     mobile    < 768   телефоны: своя навигация, карта со шторкой
//     tablet    768–1199 (768–1023 стоя: шторка; 1024–1199: боковая панель)
//     desktop   1200–1919
//     full-hd   1920–2559
//     2k        2560–3839
//     4k        ≥ 3840
//   форма — портрет (высота ≥ ширины, квадрат тоже), альбом, ультраширокий (≥ 2,1 : 1 от 1200 px —
//           только CSS: (min-aspect-ratio: 21/10) в adaptations/ultrawide/, структура не меняется);
//   высота — невысокое альбомное окно (short).
//
// Масштаб интерфейса (корневой шрифт) уровни не задают — его считает одна формула от размеров окна
// (adaptations/scale.css); код в пикселях читает итог через rootScale().
export const BREAKPOINTS = {
  tablet: 768,
  tabletWide: 1024,
  desktop: 1200,
  fullHd: 1920,
  qhd: 2560,
  uhd: 3840,
};

// Невысокое окно: зум браузера 175 %, открытые DevTools, окно на половину экрана.
export const SHORT_HEIGHT = 600;
// Телефон лёжа: по ширине — планшет, но высоты почти нет (812 × 375, 932 × 430).
const PHONE_LANDSCAPE_HEIGHT = 500;

export function tierFor(width) {
  if (width < BREAKPOINTS.tablet) return 'mobile';
  if (width < BREAKPOINTS.desktop) return 'tablet';
  if (width < BREAKPOINTS.fullHd) return 'desktop';
  if (width < BREAKPOINTS.qhd) return 'full-hd';
  if (width < BREAKPOINTS.uhd) return '2k';
  return '4k';
}

// Портрет — как у CSS (orientation: portrait): квадратное окно тоже портрет.
export const isPortrait = (width, height) => height >= width;

// Компактная раскладка карты — телефоны, планшеты стоя (до 1023 px) и любой портретный экран уже
// десктопа (iPad Pro стоя — 1024 × 1366): детали карты открываются в шторке. Портретному монитору от
// 1200 px места на боковые панели хватает.
export function isCompact(width, height) {
  return (
    width < BREAKPOINTS.tabletWide || (isPortrait(width, height) && width < BREAKPOINTS.desktop)
  );
}

// Одна колонка — главная, «О проекте» и текстовые страницы на любом портретном экране, включая
// мониторы (1440 × 2560, повёрнутый 4K): раскладка «рядом» нужна альбомному окну от 1024 px.
// CSS: (max-width: 1023px), (orientation: portrait) — adaptations/stacked/.
export function isStacked(width, height) {
  return width < BREAKPOINTS.tabletWide || isPortrait(width, height);
}

// Раскладка «рядом» для matchMedia / GSAP matchMedia — обратное условие к isStacked.
export const WIDE_QUERY = `(min-width: ${BREAKPOINTS.tabletWide}px) and (orientation: landscape)`;

export function isShort(width, height) {
  return width >= BREAKPOINTS.tabletWide && width > height && height < SHORT_HEIGHT;
}

export const COARSE_POINTER = '(pointer: coarse)';

// Телефон лёжа: капсула таб-бара и шторка съели бы половину экрана, поэтому навигация здесь
// телефонная — две плавающие кнопки.
export function isPhoneLandscape(width, height) {
  return width > height && width < BREAKPOINTS.tabletWide && height < PHONE_LANDSCAPE_HEIGHT;
}

// Эффекты (живой фон, переход между страницами) на узком экране упрощаются — тот же порог, что у
// уровня mobile.
export const isPhoneWidth = (width) => width < BREAKPOINTS.tablet;
