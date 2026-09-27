import { format } from '@/shared/lib/format';
import texts from '@/texts/stats.json';
import styles from './MetricLegend.module.css';

// Цветовая шкала карты дашборда: настроение (плохо → хорошо) или сообщения (меньше всех → больше
// всех в городе).
export function MetricLegend({ metric, range = { min: 0, max: 0 }, period }) {
  const legend = texts.metrics[metric];
  return (
    <div className={styles.root}>
      <div className={styles.scale} data-metric={metric} aria-hidden="true" />
      <div className={styles.ends}>
        <span>{format(legend.low, range)}</span>
        <span>{format(legend.high, range)}</span>
      </div>
      <p className={styles.row}>
        <span className={styles.none} aria-hidden="true" />
        {texts.metrics.noData}
      </p>
      <p className={styles.note}>
        {format(legend.note, { period: texts.periods[period] })} {texts.metrics.height}
      </p>
    </div>
  );
}
