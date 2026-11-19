import { DistrictLegend } from '@/features/map';
import { MoodLegend, PeriodSwitch } from '@/features/mood';
import { StatusChip } from '@/features/problems';
import { MetricLegend } from '@/features/stats';
import { STATS_PERIODS } from '@/shared/config/periods';
import { PROBLEM_STATUSES } from '@/shared/config/problemStatuses';
import { format } from '@/shared/lib/i18n/format';
import { formatTime } from '@/shared/lib/i18n/formatDate';
import texts from '@/texts/en/map.json';
import { Button } from '@/shared/ui/controls/Button';
import { DistrictsVisibility } from './DistrictsVisibility';
import { FilterChoice } from './FilterChoice';
import { FilterGroup } from './FilterGroup';
import { HeightScaleControl } from './HeightScaleControl';
import styles from './MapFilters.module.css';

const LAYERS = ['districts', 'mood', 'problems'];
const METRICS = ['mood', 'problems'];

// Что показывает карта. Те же элементы живут в левой панели десктопа, в панели инструментов
// планшета в альбомной ориентации (только переключатели) и в шторке фильтров телефона (без
// заголовка).
// explore: период настроения, слой, легенда слоя; stats: период дашборда, метрика на районах, её
// цветовая шкала.
export function MapFilters({
  view,
  cityName,
  cities,
  citySlug,
  onCity,
  sheet = false,
  period,
  onPeriod,
  layer,
  onLayer,
  statsPeriod,
  onStatsPeriod,
  metric,
  onMetric,
  heightScale,
  onHeightScale,
  districtsVisible,
  onDistrictsVisible,
  range,
  districts,
  selectedSlug,
  onSelectDistrict,
  updatedAt,
  onHelp,
}) {
  const isStats = view === 'stats';
  return (
    <>
      {!sheet && (
        <div data-ui="map-filters-heading">
          <p className={styles.kicker}>{cityName}</p>
          <h1 className={styles.heading}>{isStats ? texts.stats.heading : texts.heading}</h1>
        </div>
      )}

      {cities?.length > 1 && (
        <FilterGroup label={texts.city}>
          <FilterChoice
            label={texts.cityLabel}
            value={citySlug}
            onChange={onCity}
            options={cities.map((item) => [item.slug, item.name])}
            columns={3}
            wrap
          />
        </FilterGroup>
      )}

      <FilterGroup label={texts.period}>
        {isStats ? (
          <PeriodSwitch value={statsPeriod} onChange={onStatsPeriod} options={STATS_PERIODS} />
        ) : (
          <PeriodSwitch value={period} onChange={onPeriod} />
        )}
      </FilterGroup>

      <FilterGroup label={isStats ? texts.stats.metric : texts.layer}>
        {isStats ? (
          <FilterChoice
            label={texts.stats.metricLabel}
            value={metric}
            onChange={onMetric}
            options={METRICS.map((code) => [code, texts.stats.metrics[code]])}
          />
        ) : (
          <FilterChoice
            label={texts.layerLabel}
            value={layer}
            onChange={onLayer}
            options={LAYERS.map((code) => [code, texts.layers[code]])}
          />
        )}
      </FilterGroup>

      <HeightScaleControl value={heightScale} onChange={onHeightScale} withHint={!isStats} />

      <DistrictsVisibility value={districtsVisible} onChange={onDistrictsVisible} />

      <FilterGroup
        label={isStats ? texts.stats.legend : texts.legendTitles[layer]}
        dataUi="map-filters-legend"
        className={
          !isStats && layer === 'districts' && !sheet
            ? `${styles.legend} ${styles.shrinkable}`
            : styles.legend
        }
      >
        {/* key: при смене слоя или показателя легенда появляется заново — мягко поднимается */}
        <div key={isStats ? `stats:${metric}` : layer} className={styles.legendBody}>
          {isStats && <MetricLegend metric={metric} period={statsPeriod} range={range} />}
          {!isStats && layer === 'districts' && !sheet && (
            <DistrictLegend
              districts={districts}
              selectedSlug={selectedSlug}
              onSelect={onSelectDistrict}
            />
          )}
          {!isStats && layer === 'districts' && sheet && (
            <p className={styles.hint}>{texts.filters.districtsHint}</p>
          )}
          {!isStats && layer === 'mood' && <MoodLegend />}
          {!isStats && layer === 'problems' && (
            <div className={styles.statuses}>
              {PROBLEM_STATUSES.map((status) => (
                <StatusChip key={status.code} status={status.code} />
              ))}
            </div>
          )}
        </div>
      </FilterGroup>

      <p className={styles.footnote} data-ui="map-filters-footnote">
        {updatedAt ? format(texts.updatedAt, { time: formatTime(updatedAt) }) : texts.loading}
        <br />
        {texts.districtsSource}
      </p>
      {onHelp && (
        <Button variant="text" onClick={onHelp} data-ui="map-tour-replay">
          {texts.tour.replay}
        </Button>
      )}
    </>
  );
}
