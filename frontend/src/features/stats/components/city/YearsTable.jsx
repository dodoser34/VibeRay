import { useRef } from 'react';
import { MoodFace } from '@/features/mood';
import { gsap, useGSAP } from '@/shared/animations/gsapSetup';
import { moodCodeForScore } from '@/shared/config/moods';
import { formatNumber, formatSigned } from '@/shared/lib/formatNumber';
import { useRevealed } from '@/shared/hooks/useRevealed';
import texts from '@/texts/ru/stats.json';
import { groupByYear } from '../lib/seriesLabels';
import styles from './YearsTable.module.css';

// «Все годы»: строка на каждый календарный год — настроение, отметки и сообщения с полосками для
// сравнения.
export function YearsTable({ series }) {
  const bodyRef = useRef(null);
  const revealed = useRevealed();
  const years = groupByYear(series);
  const maxMarks = Math.max(1, ...years.map((year) => year.marks));
  const maxProblems = Math.max(1, ...years.map((year) => year.problems));

  useGSAP(
    () => {
      gsap.from(bodyRef.current.children, { autoAlpha: 0, y: 8, duration: 0.5, stagger: 0.06 });
    },
    { scope: bodyRef },
  );

  return (
    <table className={styles.table}>
      <caption className={styles.caption}>{texts.years.caption}</caption>
      <thead>
        <tr>
          <th scope="col">{texts.years.columns.year}</th>
          <th scope="col">{texts.years.columns.mood}</th>
          <th scope="col">{texts.years.columns.marks}</th>
          <th scope="col">{texts.years.columns.problems}</th>
        </tr>
      </thead>
      <tbody ref={bodyRef}>
        {years.map((year, i) => (
          <tr key={year.year}>
            <th scope="row" className={styles.year}>
              {year.year}
              {i === years.length - 1 && <span className={styles.now}>{texts.years.current}</span>}
            </th>
            <td>
              {year.score === null ? (
                <span className={styles.none}>{texts.table.noData}</span>
              ) : (
                <span className={styles.mood}>
                  <MoodFace mood={moodCodeForScore(year.score)} size={20} label="" />
                  {formatSigned(year.score)}
                </span>
              )}
            </td>
            <td>
              <span className={styles.value}>{formatNumber(year.marks)}</span>
              <span className={styles.track} aria-hidden="true">
                <span
                  className={styles.fill}
                  style={{ '--share': revealed ? year.marks / maxMarks : 0, '--i': i }}
                />
              </span>
            </td>
            <td>
              <span className={styles.value}>{formatNumber(year.problems)}</span>
              <span className={styles.track} aria-hidden="true">
                <span
                  className={styles.fill}
                  data-kind="problems"
                  style={{ '--share': revealed ? year.problems / maxProblems : 0, '--i': i }}
                />
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
