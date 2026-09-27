import * as THREE from 'three';
import { MOOD_SCALE, NO_DATA_COLOR_VAR } from '@/shared/config/moods';
import { cssVar } from '@/shared/lib/cssVar';

export function colorForScore(score) {
  const s = Math.min(2, Math.max(-2, score));
  for (let i = 0; i < MOOD_SCALE.length - 1; i++) {
    const from = MOOD_SCALE[i];
    const to = MOOD_SCALE[i + 1];
    if (s <= to.score) {
      const t = (s - from.score) / (to.score - from.score);
      return new THREE.Color(cssVar(from.colorVar)).lerp(new THREE.Color(cssVar(to.colorVar)), t);
    }
  }
  return new THREE.Color(cssVar(MOOD_SCALE[MOOD_SCALE.length - 1].colorVar));
}

// Цвет района на эталонной схеме (как пастельный токен).
export function colorForDistrict(palette) {
  return new THREE.Color(cssVar(palette ? `--district-${palette}` : NO_DATA_COLOR_VAR));
}

export function colorForNoData() {
  return new THREE.Color(cssVar(NO_DATA_COLOR_VAR));
}

export function colorForAggregate(aggregate) {
  if (!aggregate || aggregate.insufficient_data) return colorForNoData();
  return colorForScore(aggregate.score);
}
