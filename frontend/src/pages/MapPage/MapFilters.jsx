import { DistrictLegend } from '@/features/map';
import { MoodLegend, PeriodSwitch } from '@/features/mood';
import { StatusChip } from '@/features/problems';
import { MetricLegend } from '@/features/stats';
import { STATS_PERIODS } from '@/shared/config/periods';
import { PROBLEM_STATUSES } from '@/shared/config/problemStatuses';
import { format } from '@/shared/lib/format';
import { formatTime } from '@/shared/lib/formatDate';
import texts from '@/texts/ru/map.json';
import { Button } from '@/shared/ui/Button';
import styles from './MapFilters.module.css';

const LAYERS = ['districts', 'mood', 'problems'];
const METRICS = ['mood', 'problems'];

function Choice({ options, value, onChange, label }) {
  return (
    <div
      className={styles.choices}
      style={{ '--count': options.length }}
      role="radiogroup"
      aria-label={label}
    >
      {options.map(([code, text]) => (
        <button
          key={code}
          type="button"
          role="radio"
          aria-checked={value === code}
          className={styles.choice}
          data-ui="map-choice"
          onClick={() => onChange(code)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

// Что показывает карта. Те же элементы живут в левой панели десктопа, в панели инструментов
// планшета в альбомной ориентации (только переключатели) и в шторке фильтров телефона (без
// заголовка).
// explore: период настроения, слой, легенда слоя; stats: период дашборда, метрика на районах, её
// цветовая шкала.
export function MapFilters({
  view,
  cityName,
  sheet = false,
  period,
  onPeriod,
  layer,
  onLayer,
  statsPeriod,
  onStatsPeriod,
  metric,
  onMetric,
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

      <div className={styles.group}>
        <span className={styles.groupLabel}>{texts.period}</span>
        {isStats ? (
          <PeriodSwitch value={statsPeriod} onChange={onStatsPeriod} options={STATS_PERIODS} />
        ) : (
          <PeriodSwitch value={period} onChange={onPeriod} />
        )}
      </div>

      <div className={styles.group}>
        <span className={styles.groupLabel}>{isStats ? texts.stats.metric : texts.layer}</span>
        {isStats ? (
          <Choice
            label={texts.stats.metricLabel}
            value={metric}
            onChange={onMetric}
            options={METRICS.map((code) => [code, texts.stats.metrics[code]])}
          />
        ) : (
          <Choice
            label={texts.layerLabel}
            value={layer}
            onChange={onLayer}
            options={LAYERS.map((code) => [code, texts.layers[code]])}
          />
        )}
      </div>

      <div className={styles.group} data-ui="map-filters-legend">
        <span className={styles.groupLabel}>
          {isStats ? texts.stats.legend : texts.legendTitles[layer]}
        </span>
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
            {PROBLEM_STATUSES.map((s) => (
              <StatusChip key={s.code} status={s.code} />
            ))}
          </div>
        )}
      </div>

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
