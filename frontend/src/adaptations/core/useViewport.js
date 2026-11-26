import { useSyncExternalStore } from 'react';
import { isCompact, isPhoneLandscape, tierFor } from './breakpoints';

function subscribe(callback) {
  window.addEventListener('resize', callback);
  return () => window.removeEventListener('resize', callback);
}

// Снимок-строка: React перерисовывает только при реальной смене уровня, а не на каждый пиксель
// ресайза. innerWidth включает классическую полосу прокрутки — ту же ширину используют
// медиазапросы CSS.
function snapshot() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  return [
    tierFor(width),
    isCompact(width, height) ? 'compact' : 'wide',
    height > width ? 'portrait' : 'landscape',
    isPhoneLandscape(width, height) ? 'phone' : 'other',
  ].join('|');
}

// Уровень устройства для компонентов, которые меняют структуру, а не только стили (мобильное меню
// вместо таб-бара; compact — шторка вместо боковых панелей, главная в одну колонку; portrait —
// экран выше, чем шире: по нему перестраиваются кадры, рассчитанные под пропорции экрана).
export function useViewport() {
  const [tier, layout, orientation, landscapePhone] = useSyncExternalStore(
    subscribe,
    snapshot,
    () => 'desktop|wide|landscape|other',
  ).split('|');
  return {
    tier,
    isMobile: tier === 'mobile',
    // Телефонная навигация (плавающие кнопки и меню): телефоны стоя и лёжа.
    phoneNav: tier === 'mobile' || landscapePhone === 'phone',
    isDesktop: tier !== 'mobile' && tier !== 'tablet',
    compact: layout === 'compact',
    portrait: orientation === 'portrait',
  };
}
