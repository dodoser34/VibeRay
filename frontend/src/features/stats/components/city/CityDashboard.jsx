import { useRef } from 'react';
import { CATEGORY_BY_CODE } from '@/shared/config/problemCategories';
import { useRiseOnLoad } from '@/shared/animations/effects/useRiseOnLoad';
import { format } from '@/shared/lib/i18n/format';
import { formatFullDate } from '@/shared/lib/i18n/formatDate';
import { percentOf } from '@/shared/lib/i18n/formatNumber';
import { BarList } from '@/shared/ui/charts/BarList';
import texts from '@/texts/en/stats.json';
import { DistrictCompare } from './DistrictCompare';
import { DistrictTable } from './DistrictTable';
import { MoodChart } from '../common/MoodChart';
import { MoodDistribution } from '../common/MoodDistribution';
import { StatusBreakdown } from '../common/StatusBreakdown';
import { YearsTable } from './YearsTable';
import { DashboardBlock } from './DashboardBlock';
import { CityKpis } from './CityKpis';
import styles from './CityDashboard.module.css';
import { CloseButton } from '@/shared/ui/controls/CloseButton';

const t = texts.dashboard;

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
  const bodyRef = useRef(null);
  useRiseOnLoad(bodyRef, loading);
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
        {onClose && <CloseButton label={t.close} onClick={onClose} />}
      </header>

      {!stats ? (
        <div className={styles.skeleton} aria-label={texts.loading} />
      ) : (
        <div ref={bodyRef} className={styles.body} data-loading={loading}>
          <CityKpis stats={stats} />

          {!stats.mood.insufficient_data && (
            <DashboardBlock title={texts.distributionTitle}>
              <MoodDistribution distribution={stats.mood.distribution} />
            </DashboardBlock>
          )}

          <DashboardBlock title={format(texts.dynamics, { period: texts.periods[period] })}>
            <MoodChart series={stats.series} period={period} height={200} />
          </DashboardBlock>

          {period === 'all' && (
            <DashboardBlock title={t.yearsTitle}>
              <YearsTable series={stats.series} />
            </DashboardBlock>
          )}

          <DashboardBlock title={t.districtsTitle}>
            <p className={styles.note}>{t.districtsHint}</p>
            <DistrictTable
              rows={stats.districts.map((row) => ({ ...row, name: names[row.district] ?? '' }))}
              focusSlug={focusSlug}
              onFocus={onFocusDistrict}
              onHover={onHoverDistrict}
              onOpen={onOpenDistrict}
            />
          </DashboardBlock>

          {stats.districts.length > 1 && (
            <DashboardBlock title={texts.districtCompare.title}>
              <DistrictCompare
                period={period}
                rows={stats.districts}
                names={names}
                onHover={onHoverDistrict}
              />
            </DashboardBlock>
          )}

          {stats.categories.length > 0 && (
            <DashboardBlock title={t.categoriesTitle}>
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
            </DashboardBlock>
          )}

          {stats.problems.reported > 0 && (
            <DashboardBlock title={texts.statusesTitle}>
              <StatusBreakdown
                byStatus={stats.problems.by_status}
                total={stats.problems.reported}
                label={t.statusesLabel}
              />
            </DashboardBlock>
          )}

          <p className={styles.note}>{t.privacy}</p>
        </div>
      )}
    </section>
  );
}
