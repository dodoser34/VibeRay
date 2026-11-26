import { WIDE_QUERY } from '@/adaptations/core';

// Девушка выезжает снизу последней, когда вступление главной уже сыграно: лист (FrontLayer,
// FRONT_FLOW_END), заголовок (HomePage) и пропуск (AuthPanel) с полями формы — до ≈ 3,9 с на
// широких экранах и ≈ 2,8 с на узких.
export const GIRL_ENTRANCE = { duration: 1.6, ease: 'power3.out' };

export const girlEntranceDelay = () => (window.matchMedia(WIDE_QUERY).matches ? 3.9 : 2.8);
