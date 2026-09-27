import * as THREE from 'three';
import { cssVar } from '@/shared/lib/cssVar';

// Ключевые моменты суток; между ними параметры плавно смешиваются. Свет остаётся почти нейтральным
// (районы сохраняют свои цвета): утром и вечером он мягче и чуть теплее, ночью — тише и холоднее,
// а в районах горят окна. night — насколько фон и туман уходят в ночной оттенок.
const KEYS = [
  { hour: 0, light: '--scene-light-night', key: 0.6, hemi: 0.85, night: 1, windows: 1 },
  { hour: 5, light: '--scene-light-night', key: 0.65, hemi: 0.9, night: 1, windows: 0.8 },
  { hour: 6.5, light: '--scene-light-dawn', key: 1.5, hemi: 1.3, night: 0.4, windows: 0.25 },
  { hour: 9, light: '--scene-light', key: 2.1, hemi: 1.7, night: 0, windows: 0 },
  { hour: 17, light: '--scene-light', key: 2.1, hemi: 1.7, night: 0, windows: 0 },
  { hour: 19.5, light: '--scene-light-dusk', key: 1.4, hemi: 1.25, night: 0.45, windows: 0.55 },
  { hour: 21.5, light: '--scene-light-night', key: 0.6, hemi: 0.85, night: 1, windows: 1 },
  { hour: 24, light: '--scene-light-night', key: 0.6, hemi: 0.85, night: 1, windows: 1 },
];

const NIGHT_POSITION = new THREE.Vector3(-6, 12, 8);

// Солнце идёт с востока (x+) на запад (x−) и выше всего в полдень; ночью свет — «луна» сверху слева.
function sunPosition(hour, target) {
  const t = Math.min(1, Math.max(0, (hour - 6) / 12));
  return target.set(10 * Math.cos(t * Math.PI), 5 + 9 * Math.sin(t * Math.PI), 8);
}

export function lightingAt(hour) {
  const h = ((hour % 24) + 24) % 24;
  const next = KEYS.findIndex((key) => key.hour > h);
  const a = KEYS[next - 1];
  const b = KEYS[next];
  const t = (h - a.hour) / (b.hour - a.hour);
  const mix = (x, y) => x + (y - x) * t;
  const night = mix(a.night, b.night);
  return {
    color: new THREE.Color(cssVar(a.light)).lerp(new THREE.Color(cssVar(b.light)), t),
    keyIntensity: mix(a.key, b.key),
    hemiIntensity: mix(a.hemi, b.hemi),
    night,
    windows: mix(a.windows, b.windows),
    background: new THREE.Color(cssVar('--scene-bg')).lerp(
      new THREE.Color(cssVar('--scene-bg-night')),
      night,
    ),
    position: sunPosition(h, new THREE.Vector3()).lerp(NIGHT_POSITION, night),
  };
}
