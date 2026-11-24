import { useSyncExternalStore } from 'react';
import { COARSE_POINTER, isCompact, isPhoneLandscape, tierFor } from './breakpoints';

function subscribe(callback) {
  const coarse = window.matchMedia(COARSE_POINTER);
  window.addEventListener('resize', callback);
  coarse.addEventListener('change', callback);
  return () => {
    window.removeEventListener('resize', callback);
    coarse.removeEventListener('change', callback);
  };
}

// Снимок-строка: React перерисовывает только при реальной смене уровня (или типа указателя), а не
// на каждый пиксель ресайза.
function snapshot() {
  // innerWidth включает классическую полосу прокрутки — ту же ширину используют медиазапросы CSS.
  const width = window.innerWidth;
  const compact = isCompact(width, window.innerHeight);
  const coarse = window.matchMedia(COARSE_POINTER).matches;
  const orientation = window.innerHeight > width ? 'portrait' : 'landscape';
  const phoneLandscape = isPhoneLandscape(width, window.innerHeight);
  return [
    tierFor(width),
    compact ? 'compact' : 'wide',
    coarse ? 'coarse' : 'fine',
    orientation,
    phoneLandscape ? 'phone' : 'other',
  ].join('|');
}

// Уровень устройства для компонентов, которые меняют структуру, а не только стили (мобильное меню
// вместо таб-бара; `compact`: шторка вместо боковых панелей, главная в одну колонку; `portrait`:
// экран выше, чем шире — по нему перестраиваются кадры, рассчитанные под пропорции экрана).
export function useViewport() {
  const [tier, layout, pointer, orientation, landscapePhone] = useSyncExternalStore(
    subscribe,
    snapshot,
    () => 'desktop|wide|fine|landscape|other',
  ).split('|');
  return {
    tier,
    isMobile: tier === 'mobile',
    // Телефонная навигация (плавающие кнопки и меню): телефоны стоя и лёжа
    phoneNav: tier === 'mobile' || landscapePhone === 'phone',
    isTablet: tier === 'tablet',
    isDesktop: tier !== 'mobile' && tier !== 'tablet',
    compact: layout === 'compact',
    coarse: pointer === 'coarse',
    portrait: orientation === 'portrait',
  };
}
