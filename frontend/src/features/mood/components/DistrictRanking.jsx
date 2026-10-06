import { useRef } from 'react';
import { useFlipList } from '@/shared/animations/effects/useFlipList';
import { gsap, useGSAP } from '@/shared/animations/gsapSetup';
import { MOOD_BY_CODE, moodCodeForScore } from '@/shared/config/moods';
import { formatSigned } from '@/shared/lib/formatNumber';
import { useRevealed } from '@/shared/hooks/useRevealed';
import { MoodFace } from './MoodFace';
import styles from './DistrictRanking.module.css';

// Обзор города: районы от лучшего настроения к худшему. При смене периода строки переезжают на
// новые места; тонкая полоска показывает, где оценка на шкале −2…+2.
export function DistrictRanking({ districts, moods, onSelect }) {
  const listRef = useRef(null);
  const revealed = useRevealed();
  const rows = districts
    .map((district) => ({ ...district, mood: moods?.districts[district.slug] }))
    .sort((a, b) => (b.mood?.score ?? -99) - (a.mood?.score ?? -99));

  useFlipList(listRef, rows.map((row) => row.slug).join());

  useGSAP(
    () => {
      if (!rows.length) return;
      gsap.from(listRef.current.children, {
        autoAlpha: 0,
        y: 8,
        duration: 0.5,
        stagger: 0.035,
        ease: 'power3.out',
      });
    },
    { scope: listRef, dependencies: [rows.length > 0] },
  );

  return (
    <ol ref={listRef} className={styles.list}>
      {rows.map((row, i) => {
        const hasData = row.mood && !row.mood.insufficient_data;
        const code = hasData ? moodCodeForScore(row.mood.score) : null;
        return (
          <li key={row.slug} data-flip={row.slug}>
            <button type="button" className={styles.row} onClick={() => onSelect(row.slug)}>
              <span className={styles.rank}>{i + 1}</span>
              <MoodFace mood={code} size={28} label="" />
              <span className={styles.name}>{row.name}</span>
              <span className={styles.score}>{hasData ? formatSigned(row.mood.score) : '—'}</span>
              <span className={styles.scale} aria-hidden="true">
                <span
                  className={styles.fill}
                  style={{
                    '--value': revealed && hasData ? row.mood.score / 2 : 0,
                    background: code ? `var(${MOOD_BY_CODE[code].colorVar})` : undefined,
                  }}
                />
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
