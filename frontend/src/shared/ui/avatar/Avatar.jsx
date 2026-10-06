import { useId } from 'react';
import styles from './Avatar.module.css';

// Аватары-пресеты («preset:N») — для участия не нужно личное фото.
export const AVATAR_PRESETS = [
  { from: '--color-accent-bright', to: '--color-river', glyph: 'wave' },
  { from: '--mood-excellent', to: '--color-river', glyph: 'leaf' },
  { from: '--mood-normal', to: '--mood-bad', glyph: 'sun' },
  { from: '--mood-angry', to: '--color-accent-bright', glyph: 'heart' },
  { from: '--color-river', to: '--color-accent', glyph: 'drop' },
  { from: '--mood-good', to: '--mood-normal', glyph: 'star' },
  { from: '--color-accent', to: '--mood-very-bad', glyph: 'moon' },
  { from: '--mood-anxious', to: '--mood-excellent', glyph: 'spark' },
];

const GLYPHS = {
  wave: <path d="M10 26c4-5 8-5 12 0s8 5 12 0M10 18c4-5 8-5 12 0s8 5 12 0" />,
  leaf: <path d="M12 30c0-10 6-17 20-18-1 13-8 19-18 19M14 29l11-11" />,
  sun: (
    <>
      <circle cx="22" cy="22" r="6" />
      <path d="M22 8v4M22 32v4M8 22h4M32 22h4M12 12l3 3M29 29l3 3M12 32l3-3M29 15l3-3" />
    </>
  ),
  heart: <path d="M22 31s-10-6-10-13a5.5 5.5 0 0 1 10-3 5.5 5.5 0 0 1 10 3c0 7-10 13-10 13z" />,
  drop: <path d="M22 9s-9 10-9 16a9 9 0 0 0 18 0c0-6-9-16-9-16z" />,
  star: <path d="M22 9l3.8 8.2 8.7 1-6.4 6 1.7 8.8L22 28.6 14.2 33l1.7-8.8-6.4-6 8.7-1z" />,
  moon: <path d="M27 10a12 12 0 1 0 7 17 10 10 0 0 1-7-17z" />,
  spark: <path d="M22 8v28M8 22h28M13 13l18 18M31 13L13 31" />,
};

function presetIndex(src) {
  const match = /^preset:(\d+)$/.exec(src ?? '');
  return match ? Number(match[1]) % AVATAR_PRESETS.length : null;
}

export function Avatar({ src, size = 40, label = '', className = '' }) {
  const gradientId = useId();
  const index = presetIndex(src);

  if (index === null && src) {
    return (
      <img
        className={`${styles.root} ${className}`}
        src={src}
        alt={label}
        width={size}
        height={size}
        style={{ width: `${size / 16}rem`, height: `${size / 16}rem` }}
      />
    );
  }

  const preset = AVATAR_PRESETS[index ?? 0];
  return (
    <svg
      className={`${styles.root} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 44 44"
      style={{ width: `${size / 16}rem`, height: `${size / 16}rem` }}
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: `var(${preset.from})` }} />
          <stop offset="1" style={{ stopColor: `var(${preset.to})` }} />
        </linearGradient>
      </defs>
      <circle cx="22" cy="22" r="22" fill={`url(#${gradientId})`} />
      <g className={styles.glyph}>{GLYPHS[preset.glyph]}</g>
    </svg>
  );
}
