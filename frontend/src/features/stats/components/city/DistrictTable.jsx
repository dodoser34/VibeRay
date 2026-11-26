import { useEffect, useRef, useState } from 'react';
import { MoodFace } from '@/features/mood';
import { gsap, useGSAP } from '@/shared/animations/core/gsapSetup';
import { useFlipList } from '@/shared/animations/effects/useFlipList';
import { MOOD_BY_CODE, moodCodeForScore } from '@/shared/config/moods';
import { useRevealed } from '@/shared/hooks/useRevealed';
import { format } from '@/shared/lib/i18n/format';
import { formatNumber, formatSigned, percentOf } from '@/shared/lib/i18n/formatNumber';
import { getLocale } from '@/shared/lib/i18n/language';
import { plural } from '@/shared/lib/i18n/plural';
import texts from '@/texts/en/stats.json';
import { trendDirection } from '../../lib/trend';
import styles from './DistrictTable.module.css';

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

function sortRows(rows, { key, direction }) {
  const get = COLUMNS[key].get;
  const sign = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const [valueA, valueB] = [get(a), get(b)];
    // Районы без данных — в конце при любом направлении.
    if (valueA === null || valueB === null) return valueA === valueB ? 0 : valueA === null ? 1 : -1;
    if (typeof valueA === 'string') return sign * valueA.localeCompare(valueB, getLocale());
    return sign * (valueA - valueB);
  });
}

// Все районы за период: настроение, тренд, проблемы. Сортировка по колонке переносит строки на
// новые места; наведение на строку приподнимает район на карте, клик — перелёт к нему.
export function DistrictTable({ rows, focusSlug, onFocus, onHover, onOpen }) {
  const [sort, setSort] = useState({ key: 'mood', direction: 'desc' });
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
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: COLUMNS[key].first },
    );

  // dataUi — имя колонки для адаптаций (на планшете тренд прячется), className — выравнивание
  // чисел.
  const header = (key, { dataUi, className } = {}) => (
    <th
      scope="col"
      className={className}
      data-ui={dataUi && `district-table-${dataUi}`}
      aria-sort={
        sort.key === key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined
      }
    >
      <button
        type="button"
        className={styles.sort}
        data-ui="table-sort"
        onClick={() => sortBy(key)}
      >
        {texts.table.columns[key]}
        <span
          className={styles.arrow}
          data-direction={sort.key === key ? sort.direction : undefined}
        />
      </button>
    </th>
  );

  return (
    <table className={styles.table}>
      <caption className="visually-hidden">{texts.table.caption}</caption>
      <thead>
        <tr>
          <th scope="col" className={styles.rankHead}>
            <span className="visually-hidden">{texts.table.columns.rank}</span>
          </th>
          {header('name')}
          {header('mood')}
          {header('trend', { dataUi: 'trend' })}
          {header('problems', { className: styles.num })}
          {header('resolved', { className: styles.num })}
        </tr>
      </thead>
      <tbody ref={bodyRef}>
        {sorted.map((row, i) => {
          const hasMood = !row.mood.insufficient_data;
          const code = hasMood ? moodCodeForScore(row.mood.score) : null;
          const trend = trendDirection(row.trend);
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
