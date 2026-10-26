import { MoodFace } from '@/features/mood';
import { CATEGORY_BY_CODE } from '@/shared/config/problemCategories';
import { MOOD_BY_CODE, moodCodeForScore } from '@/shared/config/moods';
import { format } from '@/shared/lib/format';
import { formatFullDate } from '@/shared/lib/formatDate';
import { formatSigned, percentOf } from '@/shared/lib/formatNumber';
import { AnimatedNumber } from '@/shared/ui/charts/AnimatedNumber';
import { BarList } from '@/shared/ui/charts/BarList';
import texts from '@/texts/ru/stats.json';
import { DistrictCompare } from './DistrictCompare';
import { DistrictTable } from './DistrictTable';
import { MoodChart } from './MoodChart';
import { MoodDistribution } from './MoodDistribution';
import { StatusBreakdown } from './StatusBreakdown';
import { YearsTable } from './YearsTable';
import styles from './CityDashboard.module.css';
import { Icon } from '@/shared/ui/icons/Icon';

const SAME_SCORE = 0.1;
const t = texts.dashboard;

function Block({ title, children }) {
  return (
    <section className={styles.block}>
      <h3 className={styles.blockTitle}>{title}</h3>
      {children}
    </section>
  );
}

function Kpis({ stats }) {
  const { mood, trend, problems } = stats;
  const code = mood.insufficient_data ? null : moodCodeForScore(mood.score);
  const trendKey = Math.abs(trend) < SAME_SCORE ? 'flat' : trend > 0 ? 'up' : 'down';
  const resolved = percentOf(problems.by_status.resolved, problems.reported);
  return (
    <div className={styles.kpis}>
      <div className={`${styles.kpi} ${styles.kpiMood}`}>
        <MoodFace mood={code} size={44} />
        <div>
          <span className={styles.kpiValue}>
            {code ? (
              <AnimatedNumber value={mood.score} formatValue={(v) => formatSigned(v)} />
            ) : (
              texts.table.noData
            )}
          </span>
          <span className={styles.kpiLabel}>
            {code ? format(t.kpi.mood, { mood: MOOD_BY_CODE[code].label }) : texts.fewMarks}
          </span>
          <span className={styles.trend} data-trend={trendKey}>
            {format(t.kpi.trend[trendKey], { delta: Math.abs(trend).toFixed(1) })}
          </span>
        </div>
      </div>
      <div className={styles.kpi}>
        <AnimatedNumber value={mood.sample_size} className={styles.kpiValue} />
        <span className={styles.kpiLabel}>{t.kpi.marks}</span>
      </div>
      <div className={styles.kpi}>
        <AnimatedNumber value={problems.reported} className={styles.kpiValue} />
        <span className={styles.kpiLabel}>{t.kpi.reported}</span>
      </div>
      <div className={styles.kpi}>
        <AnimatedNumber
          value={resolved}
          className={styles.kpiValue}
          formatValue={(v) => format(texts.share, { percent: Math.round(v) })}
        />
        <span className={styles.kpiLabel}>{t.kpi.resolved}</span>
      </div>
    </div>
  );
}

// Дашборд города: как жил весь город за месяц, год или все годы. Строки таблицы берут названия
// районов из `names` (slug → название).
export function CityDashboard({
  cityName,
  period,
  stats,
  loading,
  names,
  focusSlug,
  onFocusDistrict,
  onHoverDistrict,
  onOpenDistrict,
  onClose,
}) {
  return (
    <section
      className={styles.root}
      aria-labelledby="city-stats-title"
      aria-busy={loading}
      data-ui="map-detail"
    >
      <header className={styles.header} data-sheet-drag>
        <div>
          <p className={styles.kicker}>{format(t.kicker, { city: cityName })}</p>
          <h2 id="city-stats-title" className={styles.title}>
            {format(t.title, { period: texts.periods[period] })}
          </h2>
          {stats && (
            <p className={styles.since}>{format(t.since, { date: formatFullDate(stats.since) })}</p>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            className={styles.close}
            data-ui="panel-close"
            onClick={onClose}
            aria-label={t.close}
          >
            <Icon name="close" size={14} />
          </button>
        )}
      </header>

      {!stats ? (
        <div className={styles.skeleton} aria-label={texts.loading} />
      ) : (
        <div className={styles.body} data-loading={loading}>
          <Kpis stats={stats} />

          {!stats.mood.insufficient_data && (
            <Block title={texts.distributionTitle}>
              <MoodDistribution distribution={stats.mood.distribution} />
            </Block>
          )}

          <Block title={format(texts.dynamics, { period: texts.periods[period] })}>
            <MoodChart series={stats.series} period={period} height={200} />
          </Block>

          {period === 'all' && (
            <Block title={t.yearsTitle}>
              <YearsTable series={stats.series} />
            </Block>
          )}

          <Block title={t.districtsTitle}>
            <p className={styles.note}>{t.districtsHint}</p>
            <DistrictTable
              rows={stats.districts.map((row) => ({ ...row, name: names[row.district] ?? '' }))}
              focusSlug={focusSlug}
              onFocus={onFocusDistrict}
              onHover={onHoverDistrict}
              onOpen={onOpenDistrict}
            />
          </Block>

          {stats.districts.length > 1 && (
            <Block title={texts.districtCompare.title}>
              <DistrictCompare
                period={period}
                rows={stats.districts}
                names={names}
                onHover={onHoverDistrict}
              />
            </Block>
          )}

          {stats.categories.length > 0 && (
            <Block title={t.categoriesTitle}>
              <BarList
                items={stats.categories.map(({ category, count }) => ({
                  key: category,
                  label: CATEGORY_BY_CODE[category].label,
                  value: count,
                  note: format(texts.categoryShare, {
                    count,
                    percent: percentOf(count, stats.problems.reported),
                  }),
                }))}
              />
            </Block>
          )}

          {stats.problems.reported > 0 && (
            <Block title={texts.statusesTitle}>
              <StatusBreakdown
                byStatus={stats.problems.by_status}
                total={stats.problems.reported}
                label={t.statusesLabel}
              />
            </Block>
          )}

          <p className={styles.note}>{t.privacy}</p>
        </div>
      )}
    </section>
  );
}
