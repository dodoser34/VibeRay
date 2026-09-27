import { useState } from 'react';
import { MoodFace } from '@/features/mood';
import { CATEGORY_BY_CODE } from '@/shared/config/problemCategories';
import { MOOD_BY_CODE, moodCodeForScore } from '@/shared/config/moods';
import { useRevealed } from '@/shared/hooks/useRevealed';
import { format } from '@/shared/lib/format';
import { formatNumber, formatSigned } from '@/shared/lib/formatNumber';
import { plural } from '@/shared/lib/plural';
import { CompareChart } from '@/shared/ui/charts/CompareChart';
import texts from '@/texts/stats.json';
import { useDistrictStats } from '../hooks/useDistrictStats';
import { seriesPointTitle, seriesTick } from '../lib/seriesLabels';
import styles from './DistrictCompare.module.css';

const t = texts.districtCompare;
const SIDES = [
  { key: 'a', colorVar: '--compare-a', label: t.pickA },
  { key: 'b', colorVar: '--compare-b', label: t.pickB },
];
const SAME_SCORE = 0.1;
const MAX_CATEGORIES = 6;
const Y_TICKS = [
  { value: 2, label: '+2' },
  { value: 0, label: '0' },
  { value: -2, label: '−2' },
];

// По умолчанию — самый спокойный и самый напряжённый район периода: разница видна сразу.
function defaults(rows) {
  const scored = rows
    .filter((row) => !row.mood.insufficient_data)
    .sort((x, y) => y.mood.score - x.mood.score);
  const first = scored[0]?.district ?? rows[0]?.district;
  const last = scored.at(-1)?.district ?? rows[1]?.district;
  return { a: first, b: last === first ? rows.find((r) => r.district !== first)?.district : last };
}

function Summary({ side, stats, name }) {
  const mood = stats?.mood;
  const code = mood && !mood.insufficient_data ? moodCodeForScore(mood.score) : null;
  return (
    <div className={styles.card} style={{ '--tone': `var(${side.colorVar})` }}>
      <MoodFace mood={code} size={40} />
      <div className={styles.cardText}>
        <span className={styles.cardName}>{name}</span>
        {!stats ? (
          <span className={styles.cardMeta}>{t.loading}</span>
        ) : (
          <>
            <span className={styles.cardScore}>
              {code ? formatSigned(mood.score) : texts.table.noData}
              {code && <span className={styles.cardMood}>{MOOD_BY_CODE[code].label}</span>}
            </span>
            <span className={styles.cardMeta}>
              {format(t.marks, {
                count: formatNumber(mood.sample_size),
                marks: plural(mood.sample_size, texts.marks),
              })}
              {' · '}
              {format(t.reported, {
                count: stats.problems.new_in_period,
                problems: plural(stats.problems.new_in_period, t.problemForms),
              })}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// Сравнение двух районов за период дашборда: настроение на одном графике и разница в проблемах
// по категориям (зеркальные полосы). rows — строки таблицы районов (для выбора по умолчанию).
export function DistrictCompare({ period, rows, names, onHover }) {
  const [picked, setPicked] = useState(() => defaults(rows));
  const a = useDistrictStats(picked.a, period);
  const b = useDistrictStats(picked.b, period);
  const revealed = useRevealed();
  const data = { a: a.data?.district === picked.a ? a.data : null };
  data.b = b.data?.district === picked.b ? b.data : null;
  const options = [...rows].sort((x, y) => names[x.district]?.localeCompare(names[y.district]));

  const verdict = (() => {
    const [ma, mb] = [data.a?.mood, data.b?.mood];
    if (!ma || !mb) return null;
    if (ma.insufficient_data || mb.insufficient_data) return t.fewMarks;
    const delta = ma.score - mb.score;
    if (Math.abs(delta) < SAME_SCORE) return t.equal;
    return format(t.better, {
      district: names[delta > 0 ? picked.a : picked.b],
      delta: Math.abs(delta).toFixed(1),
    });
  })();

  const categories = (() => {
    if (!data.a || !data.b) return [];
    const counts = new Map();
    [data.a, data.b].forEach((stats, side) =>
      stats.categories.forEach(({ category, count }) => {
        const entry = counts.get(category) ?? [0, 0];
        entry[side] = count;
        counts.set(category, entry);
      }),
    );
    return [...counts]
      .sort((x, y) => y[1][0] + y[1][1] - (x[1][0] + x[1][1]))
      .slice(0, MAX_CATEGORIES);
  })();
  const maxCount = Math.max(1, ...categories.flatMap(([, pair]) => pair));

  const series = data.a && data.b ? [data.a.series, data.b.series] : null;

  return (
    <div className={styles.root} data-ui="district-compare">
      <p className={styles.hint}>{t.hint}</p>

      <div className={styles.pickers}>
        {SIDES.map((side) => (
          <label
            key={side.key}
            className={styles.picker}
            style={{ '--tone': `var(${side.colorVar})` }}
            onPointerEnter={() => onHover?.(picked[side.key])}
            onPointerLeave={() => onHover?.(null)}
          >
            <span className="visually-hidden">{side.label}</span>
            <span className={styles.swatch} aria-hidden="true" />
            <select
              className={styles.select}
              value={picked[side.key]}
              onChange={(event) => setPicked((p) => ({ ...p, [side.key]: event.target.value }))}
            >
              {options.map((row) => (
                <option
                  key={row.district}
                  value={row.district}
                  disabled={row.district === picked[side.key === 'a' ? 'b' : 'a']}
                >
                  {names[row.district]}
                </option>
              ))}
            </select>
            <svg className={styles.chevron} viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4 6l4 4 4-4" />
            </svg>
          </label>
        ))}
        <button
          type="button"
          className={styles.swap}
          aria-label={t.swap}
          title={t.swap}
          onClick={() => setPicked((p) => ({ a: p.b, b: p.a }))}
        >
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path d="M3 5h9l-2.5-2.5M13 11H4l2.5 2.5" />
          </svg>
        </button>
      </div>

      <div className={styles.cards}>
        {SIDES.map((side) => (
          <Summary
            key={side.key}
            side={side}
            stats={data[side.key]}
            name={names[picked[side.key]]}
          />
        ))}
      </div>
      {verdict && <p className={styles.verdict}>{verdict}</p>}

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>
          {format(t.chartTitle, { period: texts.periods[period] })}
        </h4>
        {series ? (
          <CompareChart
            series={SIDES.map((side, i) => ({
              key: `${side.key}:${picked[side.key]}`,
              colorVar: side.colorVar,
              values: series[i].map((point) => point.score),
            }))}
            yTicks={Y_TICKS}
            height={180}
            label={format(t.chartLabel, { period: texts.periods[period] })}
            formatTick={(i) => seriesTick(series[0], i, period)}
            renderTooltip={(i) => (
              <>
                <strong>{seriesPointTitle(series[0][i].t, period)}</strong>
                {SIDES.map((side, s) => {
                  const score = series[s][i]?.score ?? null;
                  const district = names[picked[side.key]];
                  return (
                    <span
                      key={side.key}
                      className={styles.tooltipRow}
                      style={{ '--tone': `var(${side.colorVar})` }}
                    >
                      {score === null
                        ? format(t.tooltipHidden, { district })
                        : format(t.tooltipValue, { district, score: formatSigned(score) })}
                    </span>
                  );
                })}
              </>
            )}
          />
        ) : (
          <div className={styles.skeleton} aria-label={t.loading} />
        )}
      </section>

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>{t.categoriesTitle}</h4>
        {series && categories.length === 0 ? (
          <p className={styles.hint}>{t.noProblems}</p>
        ) : (
          <ul className={styles.butterfly} aria-label={t.categoriesLabel}>
            {categories.map(([category, [countA, countB]]) => (
              <li key={category} className={styles.row}>
                <span className={styles.count}>{countA}</span>
                <span className={styles.track} data-side="a">
                  <span
                    className={styles.bar}
                    style={{
                      '--tone': 'var(--compare-a)',
                      transform: `scaleX(${revealed ? countA / maxCount : 0})`,
                    }}
                  />
                </span>
                <span className={styles.category}>{CATEGORY_BY_CODE[category].label}</span>
                <span className={styles.track} data-side="b">
                  <span
                    className={styles.bar}
                    style={{
                      '--tone': 'var(--compare-b)',
                      transform: `scaleX(${revealed ? countB / maxCount : 0})`,
                    }}
                  />
                </span>
                <span className={styles.count}>{countB}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
