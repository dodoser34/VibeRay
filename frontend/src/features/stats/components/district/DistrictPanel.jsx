import { useRef } from 'react';
import { ProblemListItem } from '@/features/problems';
import { useRiseOnLoad } from '@/shared/animations/effects/useRiseOnLoad';
import { CATEGORY_BY_CODE } from '@/shared/config/problemCategories';
import { format } from '@/shared/lib/i18n/format';
import { percentOf } from '@/shared/lib/i18n/formatNumber';
import { Button } from '@/shared/ui/controls/Button';
import { AnimatedNumber } from '@/shared/ui/charts/AnimatedNumber';
import { BarList } from '@/shared/ui/charts/BarList';
import texts from '@/texts/en/stats.json';
import { MoodChart } from '../common/MoodChart';
import { MoodDistribution } from '../common/MoodDistribution';
import { StatusBreakdown } from '../common/StatusBreakdown';
import { MoodSummary } from './MoodSummary';
import styles from './DistrictPanel.module.css';
import { CloseButton } from '@/shared/ui/controls/CloseButton';

const PERIOD_LABEL = texts.periods;
// Разница меньше этой читается как «так же» (оценки в диапазоне −2…+2).
const SAME_SCORE = 0.1;

// Настроение в начале и в конце периода (среднее трёх точек с каждой стороны).
function moodTrend(series) {
  const scored = series.filter((point) => point.score !== null);
  if (scored.length < 4) return 0;
  const average = (points) => points.reduce((sum, point) => sum + point.score, 0) / points.length;
  return average(scored.slice(-3)) - average(scored.slice(0, 3));
}

// facts: { rank, rankTotal, cityAverage, areaKm2 } — считает страница карты по всем районам.
export function DistrictPanel({
  district,
  cityName,
  period,
  stats,
  facts,
  loading,
  onClose,
  onMarkMood,
  onReportProblem,
  onSelectProblem,
}) {
  const trend = stats ? moodTrend(stats.series) : 0;
  const trendKey = Math.abs(trend) < SAME_SCORE ? 'flat' : trend > 0 ? 'up' : 'down';
  const problemsTotal = stats?.problems.total ?? 0;
  const bodyRef = useRef(null);
  useRiseOnLoad(bodyRef, loading);

  return (
    <section
      className={styles.root}
      aria-labelledby="district-title"
      aria-busy={loading}
      data-ui="map-detail"
    >
      <header className={styles.header} data-sheet-drag>
        <div>
          <p className={styles.kicker}>{format(texts.kicker, { city: cityName })}</p>
          <h2 id="district-title" className={styles.title}>
            {district.name}
          </h2>
          {facts && (
            <p className={styles.facts}>
              {facts.rank && (
                <span className={styles.fact} title={texts.facts.rankTitle}>
                  {format(texts.facts.rank, { rank: facts.rank, total: facts.rankTotal })}
                </span>
              )}
              {facts.areaKm2 && (
                <span className={styles.fact} title={texts.facts.areaTitle}>
                  {format(texts.facts.area, { area: facts.areaKm2.toFixed(1) })}
                </span>
              )}
            </p>
          )}
        </div>
        <CloseButton label={texts.close} onClick={onClose} />
      </header>

      {!stats ? (
        <div className={styles.skeleton} aria-label={texts.loading} />
      ) : (
        <div ref={bodyRef} className={styles.body} data-loading={loading}>
          <MoodSummary mood={stats.mood} period={period} cityAverage={facts?.cityAverage ?? null} />
          {!stats.mood.insufficient_data && (
            <div className={styles.block}>
              <h3 className={styles.blockTitle}>{texts.distributionTitle}</h3>
              <MoodDistribution distribution={stats.mood.distribution} />
            </div>
          )}

          <div className={styles.block}>
            <div className={styles.blockHead}>
              <h3 className={styles.blockTitle}>
                {format(texts.dynamics, { period: PERIOD_LABEL[period] })}
              </h3>
              <span className={styles.trend} data-trend={trendKey} title={texts.trend.title}>
                {format(texts.trend[trendKey], {
                  delta: Math.abs(trend).toFixed(1),
                  period: PERIOD_LABEL[period],
                })}
              </span>
            </div>
            <MoodChart series={stats.series} period={period} />
          </div>

          <div className={styles.tiles}>
            <div className={styles.tile}>
              <AnimatedNumber value={problemsTotal} className={styles.tileValue} />
              <span className={styles.tileLabel}>{texts.tilesTotal}</span>
            </div>
            <div className={styles.tile}>
              <AnimatedNumber value={stats.problems.active} className={styles.tileValue} />
              <span className={styles.tileLabel}>{texts.tiles.active}</span>
            </div>
            <div className={styles.tile}>
              <AnimatedNumber value={stats.problems.new_in_period} className={styles.tileValue} />
              <span className={styles.tileLabel}>
                {format(texts.tiles.new, { period: PERIOD_LABEL[period] })}
              </span>
            </div>
            <div className={styles.tile}>
              <AnimatedNumber
                value={stats.problems.by_status.resolved}
                className={styles.tileValue}
              />
              <span className={styles.tileLabel}>{texts.tiles.resolved}</span>
            </div>
          </div>

          {problemsTotal > 0 ? (
            <div className={styles.block}>
              <h3 className={styles.blockTitle}>{texts.statusesTitle}</h3>
              <StatusBreakdown byStatus={stats.problems.by_status} total={problemsTotal} />
            </div>
          ) : (
            <p className={styles.empty}>{texts.noProblems}</p>
          )}

          {stats.top_categories.length > 0 && (
            <div className={styles.block}>
              <h3 className={styles.blockTitle}>{texts.topCategories}</h3>
              <BarList
                items={stats.top_categories.map(({ category, count }) => ({
                  key: category,
                  label: CATEGORY_BY_CODE[category].label,
                  value: count,
                  note: format(texts.categoryShare, {
                    count,
                    percent: percentOf(count, problemsTotal),
                  }),
                }))}
              />
            </div>
          )}

          {stats.recent_problems.length > 0 && (
            <div className={styles.block}>
              <h3 className={styles.blockTitle}>{texts.recent}</h3>
              <div className={styles.problems}>
                {stats.recent_problems.map((problem) => (
                  <ProblemListItem key={problem.id} problem={problem} onSelect={onSelectProblem} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <footer className={styles.actions} data-ui="district-actions">
        <Button block onClick={onMarkMood}>
          {texts.markMood}
        </Button>
        <Button block variant="ghost" onClick={onReportProblem}>
          {texts.reportProblem}
        </Button>
      </footer>
    </section>
  );
}
