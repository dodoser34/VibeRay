import { format } from '@/shared/lib/i18n/format';
import { TimeSeriesChart } from '@/shared/ui/charts/TimeSeriesChart';
import texts from '@/texts/en/stats.json';
import { seriesTick } from '../../lib/seriesLabels';
import { MoodPointDetails } from './MoodPointDetails';
import styles from './MoodChart.module.css';

const Y_TICKS = [
  { value: 2, label: '+2' },
  { value: 0, label: '0' },
  { value: -2, label: '−2' },
];

// Линия настроения и новые проблемы столбиками — для одного района или всего города.
export function MoodChart({ series, period, height = 180 }) {
  return (
    <div className={styles.root}>
      <TimeSeriesChart
        points={series.map((point) => ({ value: point.score, bar: point.problems }))}
        yTicks={Y_TICKS}
        height={height}
        label={format(texts.chartLabel, { period: texts.periods[period] })}
        formatTick={(i) => seriesTick(series, i, period)}
        renderTooltip={(i) => <MoodPointDetails point={series[i]} period={period} />}
      />
      <p className={styles.legend}>
        <span className={styles.legendLine} aria-hidden="true" />
        {texts.chartLegend.mood}
        <span className={styles.legendBar} aria-hidden="true" />
        {texts.chartLegend.problems}
        <span className={styles.hint}>{texts.chartHint}</span>
      </p>
    </div>
  );
}
