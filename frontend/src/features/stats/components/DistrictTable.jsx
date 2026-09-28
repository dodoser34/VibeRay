import { useEffect, useRef, useState } from 'react';
import { MoodFace } from '@/features/mood';
import { useFlipList } from '@/shared/animations/useFlipList';
import { gsap, useGSAP } from '@/shared/animations/gsapSetup';
import { MOOD_BY_CODE, moodCodeForScore } from '@/shared/config/moods';
import { format } from '@/shared/lib/format';
import { formatNumber, formatSigned, percentOf } from '@/shared/lib/formatNumber';
import { getLocale } from '@/shared/lib/language';
import { plural } from '@/shared/lib/plural';
import { useRevealed } from '@/shared/hooks/useRevealed';
import texts from '@/texts/ru/stats.json';
import styles from './DistrictTable.module.css';

const SAME_SCORE = 0.1; // меньшие изменения читаются как «без изменений» (оценки −2…+2)

// Ключи сортировки: функция значения и направление сортировки по первому клику.
const COLUMNS = {
  name: { get: (row) => row.name, first: 'asc' },
  mood: { get: (row) => (row.mood.insufficient_data ? null : row.mood.score), first: 'desc' },
  trend: { get: (row) => row.trend, first: 'desc' },
  problems: { get: (row) => row.problems.reported, first: 'desc' },
  resolved: {
    get: (row) => (row.problems.reported ? row.problems.resolved / row.problems.reported : null),
    first: 'desc',
  },
};

function sortRows(rows, { key, dir }) {
  const get = COLUMNS[key].get;
  const sign = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const [va, vb] = [get(a), get(b)];
    if (va === null || vb === null) return va === vb ? 0 : va === null ? 1 : -1; // районы без данных — в конце
    if (typeof va === 'string') return sign * va.localeCompare(vb, getLocale());
    return sign * (va - vb);
  });
}

function trendKey(trend) {
  if (trend === null) return null;
  if (Math.abs(trend) < SAME_SCORE) return 'flat';
  return trend > 0 ? 'up' : 'down';
}

// Все районы за период: настроение, тренд, проблемы. Сортировка по колонке переносит строки на
// новые места; наведение на строку приподнимает район на карте, клик — перелёт к нему.
export function DistrictTable({ rows, focusSlug, onFocus, onHover, onOpen }) {
  const [sort, setSort] = useState({ key: 'mood', dir: 'desc' });
  const bodyRef = useRef(null);
  const revealed = useRevealed();
  const sorted = sortRows(rows, sort);

  useFlipList(bodyRef, sorted.map((row) => row.district).join());

  useGSAP(
    () => {
      gsap.from(bodyRef.current.children, {
        autoAlpha: 0,
        y: 10,
        duration: 0.5,
        stagger: 0.03,
        ease: 'power3.out',
      });
    },
    { scope: bodyRef },
  );

  useEffect(() => {
    if (!focusSlug) return;
    bodyRef.current
      ?.querySelector(`[data-flip="${focusSlug}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [focusSlug]);

  const sortBy = (key) =>
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: COLUMNS[key].first },
    );

  const header = (key, ui) => (
    <th
      scope="col"
      data-ui={ui && `district-table-${ui}`}
      aria-sort={sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
    >
      <button
        type="button"
        className={styles.sort}
        data-ui="table-sort"
        onClick={() => sortBy(key)}
      >
        {texts.table.columns[key]}
        <span className={styles.arrow} data-dir={sort.key === key ? sort.dir : undefined} />
      </button>
    </th>
  );

  return (
    <table className={styles.table}>
      <caption className={styles.caption}>{texts.table.caption}</caption>
      <thead>
        <tr>
          <th scope="col" className={styles.rankHead}>
            <span className={styles.visuallyHidden}>{texts.table.columns.rank}</span>
          </th>
          {header('name')}
          {header('mood')}
          {header('trend', 'trend')}
          {header('problems', styles.num)}
          {header('resolved', styles.num)}
        </tr>
      </thead>
      <tbody ref={bodyRef}>
        {sorted.map((row, i) => {
          const hasMood = !row.mood.insufficient_data;
          const code = hasMood ? moodCodeForScore(row.mood.score) : null;
          const trend = trendKey(row.trend);
          const focused = row.district === focusSlug;
          return (
            <tr
              key={row.district}
              data-flip={row.district}
              data-focused={focused || undefined}
              className={styles.row}
              onMouseEnter={() => onHover(row.district)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onFocus(row.district)}
            >
              <td className={styles.rank}>{i + 1}</td>
              <th scope="row" className={styles.nameCell}>
                <button
                  type="button"
                  className={styles.name}
                  aria-pressed={focused}
                  onClick={(event) => {
                    event.stopPropagation();
                    onFocus(row.district);
                  }}
                >
                  {row.name}
                </button>
                <span className={styles.sub}>
                  {format(texts.table.marks, {
                    count: formatNumber(row.mood.sample_size),
                    marks: plural(row.mood.sample_size, texts.marks),
                  })}
                </span>
                {focused && (
                  <button
                    type="button"
                    className={styles.open}
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpen(row.district);
                    }}
                  >
                    {texts.table.open}
                  </button>
                )}
              </th>
              <td>
                {hasMood ? (
                  <span className={styles.mood} title={MOOD_BY_CODE[code].label}>
                    <MoodFace mood={code} size={20} label="" />
                    <span className={styles.score}>{formatSigned(row.mood.score)}</span>
                    <span className={styles.diverge} aria-hidden="true">
                      <span
                        className={styles.divergeFill}
                        style={{
                          '--value': revealed ? row.mood.score / 2 : 0,
                          background: `var(${MOOD_BY_CODE[code].colorVar})`,
                        }}
                      />
                    </span>
                  </span>
                ) : (
                  <span className={styles.none} title={texts.table.fewMarks}>
                    {texts.table.noData}
                  </span>
                )}
              </td>
              <td data-ui="district-table-trend">
                {trend ? (
                  <span className={styles.trend} data-trend={trend}>
                    {format(texts.table.trend[trend], { delta: Math.abs(row.trend).toFixed(1) })}
                  </span>
                ) : (
                  <span className={styles.none}>{texts.table.noData}</span>
                )}
              </td>
              <td className={styles.num}>{row.problems.reported}</td>
              <td className={styles.num}>
                {row.problems.reported
                  ? format(texts.share, {
                      percent: percentOf(row.problems.resolved, row.problems.reported),
                    })
                  : texts.table.noData}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
