import { MOOD_BY_CODE } from '@/shared/config/moods';
import texts from '@/texts/mood.json';
import styles from './MoodFace.module.css';

const MOUTHS = {
  excellent: 'M13 25c3 5 15 5 18 0',
  good: 'M14 26c3 3 13 3 16 0',
  normal: 'M15 27h14',
  anxious: 'M14 28c2-2 4 2 6 0s4 2 6 0 3 1 4 0',
  bad: 'M15 29c3-3 11-3 14 0',
  angry: 'M15 29c3-3 11-3 14 0',
  very_bad: 'M14 30c3-5 13-5 16 0',
};

// Настроение в виде маленького выразительного лица; цвет — из токена настроения.
export function MoodFace({ mood, size = 32, label, className = '' }) {
  const config = MOOD_BY_CODE[mood];
  const color = config ? `var(${config.colorVar})` : 'var(--mood-none)';
  const accessibleLabel = label ?? config?.label ?? texts.noData;
  return (
    <svg
      className={`${styles.root} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 44 44"
      role={accessibleLabel ? 'img' : undefined}
      aria-label={accessibleLabel || undefined}
      aria-hidden={accessibleLabel ? undefined : true}
      style={{ '--face-color': color, width: `${size / 16}rem`, height: `${size / 16}rem` }}
    >
      <circle cx="22" cy="22" r="20" className={styles.disc} />
      {mood === 'angry' && <path d="M12 14l7 3M32 14l-7 3" className={styles.line} />}
      {mood === 'excellent' ? (
        <path d="M13 19c2-3 5-3 7 0M24 19c2-3 5-3 7 0" className={styles.line} />
      ) : (
        <>
          <circle cx="16" cy="19" r="2.2" className={styles.eye} />
          <circle cx="28" cy="19" r="2.2" className={styles.eye} />
        </>
      )}
      {config ? (
        <path d={MOUTHS[mood]} className={styles.line} />
      ) : (
        <path d="M16 27h12" className={styles.line} />
      )}
    </svg>
  );
}
