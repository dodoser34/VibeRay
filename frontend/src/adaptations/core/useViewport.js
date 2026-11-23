import { useSyncExternalStore } from 'react';
import {
  COARSE_POINTER,
  isCompact,
  isPhoneLandscape,
  isPortrait,
  isShort,
  isStacked,
  isUltrawide,
  tierFor,
} from './breakpoints';

function subscribe(callback) {
  const coarse = window.matchMedia(COARSE_POINTER);
  window.addEventListener('resize', callback);
  coarse.addEventListener('change', callback);
  return () => {
    window.removeEventListener('resize', callback);
    coarse.removeEventListener('change', callback);
  };
}

const FLAGS = ['compact', 'stacked', 'coarse', 'portrait', 'phoneLandscape', 'ultrawide', 'short'];

// Снимок-строка: React перерисовывает только при реальной смене уровня или формы окна, а не на каждый
// пиксель ресайза.
function snapshot() {
  // innerWidth включает классическую полосу прокрутки — ту же ширину используют медиазапросы CSS.
  const width = window.innerWidth;
  const height = window.innerHeight;
  const flags = {
    compact: isCompact(width, height),
    stacked: isStacked(width, height),
    coarse: window.matchMedia(COARSE_POINTER).matches,
    portrait: isPortrait(width, height),
    phoneLandscape: isPhoneLandscape(width, height),
    ultrawide: isUltrawide(width, height),
    short: isShort(width, height),
  };
  return [tierFor(width), ...FLAGS.map((flag) => (flags[flag] ? '1' : '0'))].join('|');
}

const SERVER_SNAPSHOT = ['desktop', ...FLAGS.map(() => '0')].join('|');

// Уровень устройства и форма окна для компонентов, которые меняют структуру, а не только стили
// (мобильное меню вместо таб-бара; `compact`: шторка карты вместо боковых панелей; `stacked`: главная,
// история и текстовые страницы в одну колонку; `portrait`: экран выше, чем шире, или квадрат — по нему
// перестраиваются кадры, рассчитанные под пропорции экрана; `ultrawide`, `short` — форма и высота).
export function useViewport() {
  const [tier, ...values] = useSyncExternalStore(subscribe, snapshot, () => SERVER_SNAPSHOT).split(
    '|',
  );
  const flags = Object.fromEntries(FLAGS.map((flag, i) => [flag, values[i] === '1']));
  return {
    tier,
    isMobile: tier === 'mobile',
    // Телефонная навигация (плавающие кнопки и меню): телефоны стоя и лёжа
    phoneNav: tier === 'mobile' || flags.phoneLandscape,
    isTablet: tier === 'tablet',
    isDesktop: tier !== 'mobile' && tier !== 'tablet',
    compact: flags.compact,
    stacked: flags.stacked,
    coarse: flags.coarse,
    portrait: flags.portrait,
    ultrawide: flags.ultrawide,
    short: flags.short,
  };
}
