import { MOOD_BY_CODE, moodCodeForScore } from '@/shared/config/moods';
import { format } from '@/shared/lib/format';
import { formatNumber, formatSigned } from '@/shared/lib/formatNumber';
import { plural } from '@/shared/lib/plural';
import { TimeSeriesChart } from '@/shared/ui/charts/TimeSeriesChart';
import texts from '@/texts/stats.json';
import { seriesPointTitle, seriesTick } from '../lib/seriesLabels';
import styles from './MoodChart.module.css';

const Y_TICKS = [
  { value: 2, label: '+2' },
  { value: 0, label: '0' },
  { value: -2, label: '−2' },
];

function PointDetails({ point, period }) {
  return (
    <>
      <strong>{seriesPointTitle(point.t, period)}</strong>
      <span>
        {point.score === null
          ? texts.chart.hidden
          : format(texts.chart.mood, {
              score: formatSigned(point.score),
              mood: MOOD_BY_CODE[moodCodeForScore(point.score)].label,
            })}
      </span>
      <span>
        {format(texts.chart.marks, {
          count: formatNumber(point.marks),
          marks: plural(point.marks, texts.marks),
        })}
      </span>
      <span>
        {format(texts.chart.problems, {
          count: point.problems,
          problems: plural(point.problems, texts.chart.problemForms),
        })}
      </span>
    </>
  );
}

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
        renderTooltip={(i) => <PointDetails point={series[i]} period={period} />}
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
