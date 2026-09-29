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
import { HEIGHT_SCALE } from './heightScale';
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

// Множитель высоты районов: 0 — плоская карта, дальше — во сколько раз вытянуть разницу настроений.
function HeightScale({ value, onChange, withHint }) {
  const shown = value === 0 ? texts.heightScale.flat : format(texts.heightScale.value, { value });
  return (
    <div className={styles.group} data-ui="map-filters-height">
      <label className={styles.heightHead}>
        <span className={styles.groupLabel}>{texts.heightScale.label}</span>
        <output className={styles.heightValue}>{shown}</output>
        <input
          type="range"
          className={styles.range}
          min={HEIGHT_SCALE.min}
          max={HEIGHT_SCALE.max}
          step={HEIGHT_SCALE.step}
          value={value}
          aria-valuetext={shown}
          style={{ '--fill': `${(value / HEIGHT_SCALE.max) * 100}%` }}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </label>
      {withHint && (
        <p className={styles.hint} data-ui="map-filters-height-hint">
          {texts.heightScale.hint}
        </p>
      )}
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
  heightScale,
  onHeightScale,
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

      <HeightScale value={heightScale} onChange={onHeightScale} withHint={!isStats} />

      <div className={`${styles.group} ${styles.legend}`} data-ui="map-filters-legend">
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
