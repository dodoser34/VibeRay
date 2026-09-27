// Уровни устройств по ширине окна в CSS-пикселях. Те же числа записаны в медиазапросах
// adaptations/*/ — CSS не умеет их импортировать (см. adaptations/README.md).
//
//   mobile    < 768   телефоны: своя навигация, карта со шторкой
//   tablet    768–1199 (768–1023 стоя: шторка; 1024–1199: боковая панель)
//   desktop   1200–1919
//   full-hd   1920–2559
//   2k        2560–3839
//   4k        ≥ 3840
export const BREAKPOINTS = {
  tablet: 768,
  tabletWide: 1024,
  desktop: 1200,
  fullHd: 1920,
  qhd: 2560,
  uhd: 3840,
};

export function tierFor(width) {
  if (width < BREAKPOINTS.tablet) return 'mobile';
  if (width < BREAKPOINTS.desktop) return 'tablet';
  if (width < BREAKPOINTS.fullHd) return 'desktop';
  if (width < BREAKPOINTS.qhd) return 'full-hd';
  if (width < BREAKPOINTS.uhd) return '2k';
  return '4k';
}

// Компактная раскладка — телефоны, планшеты стоя (до 1023 px) и любой портретный экран уже десктопа
// (iPad Pro стоя — 1024 × 1366): детали карты открываются в шторке, главная и текстовые страницы
// идут в одну колонку. Для раскладки «рядом» нужен альбомный экран.
export function isCompact(width, height) {
  // height >= width: квадратный экран CSS тоже считает портретным
  return width < BREAKPOINTS.tabletWide || (height >= width && width < BREAKPOINTS.desktop);
}

// То же условие для matchMedia / GSAP matchMedia (CSS-файлы повторяют его в своих @media).
export const WIDE_QUERY = `(min-width: ${BREAKPOINTS.desktop}px), (min-width: ${BREAKPOINTS.tabletWide}px) and (orientation: landscape)`;

export const COARSE_POINTER = '(pointer: coarse)';
