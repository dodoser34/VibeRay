import { WIDE_QUERY } from '@/adaptations/core';

// Девушка выезжает снизу последней, когда вступление главной уже сыграно: лист (FrontLayer, до
// 2,1 с), заголовок (HomePage, с 1,5 с) и пропуск (AuthPanel: пазл с 1,2 с на широких экранах и с
// 0,3 с на узких, затем поля формы — до ≈ 4 с и ≈ 2,8 с).
export const GIRL_ENTRANCE = { duration: 1.6, ease: 'power3.out' };

export const girlEntranceDelay = () => (window.matchMedia(WIDE_QUERY).matches ? 3.9 : 2.8);
