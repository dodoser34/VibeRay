import { MoodFace } from '@/features/mood';
import { MOOD_BY_CODE, moodCodeForScore } from '@/shared/config/moods';
import { format } from '@/shared/lib/i18n/format';
import { formatSigned, percentOf } from '@/shared/lib/i18n/formatNumber';
import { AnimatedNumber } from '@/shared/ui/charts/AnimatedNumber';
import texts from '@/texts/en/stats.json';
import { trendDirection } from '../../lib/trend';
import styles from './CityKpis.module.css';

const dashboardTexts = texts.dashboard;

// Главные числа города за период: настроение и его тренд, отметки, сообщения, доля решённых.
export function CityKpis({ stats }) {
  const { mood, trend, problems } = stats;
  const code = mood.insufficient_data ? null : moodCodeForScore(mood.score);
  const trendKey = trendDirection(trend);
  const resolved = percentOf(problems.by_status.resolved, problems.reported);
  return (
    <div className={styles.kpis}>
      <div className={`${styles.kpi} ${styles.kpiMood}`}>
        <MoodFace mood={code} size={44} />
        <div>
          <span className={styles.kpiValue}>
            {code ? (
              <AnimatedNumber value={mood.score} formatValue={(value) => formatSigned(value)} />
            ) : (
              texts.table.noData
            )}
          </span>
          <span className={styles.kpiLabel}>
            {code
              ? format(dashboardTexts.kpi.mood, { mood: MOOD_BY_CODE[code].label })
              : texts.fewMarks}
          </span>
          <span className={styles.trend} data-trend={trendKey}>
            {format(dashboardTexts.kpi.trend[trendKey], { delta: Math.abs(trend).toFixed(1) })}
          </span>
        </div>
      </div>
      <div className={styles.kpi}>
        <AnimatedNumber value={mood.sample_size} className={styles.kpiValue} />
        <span className={styles.kpiLabel}>{dashboardTexts.kpi.marks}</span>
      </div>
      <div className={styles.kpi}>
        <AnimatedNumber value={problems.reported} className={styles.kpiValue} />
        <span className={styles.kpiLabel}>{dashboardTexts.kpi.reported}</span>
      </div>
      <div className={styles.kpi}>
        <AnimatedNumber
          value={resolved}
          className={styles.kpiValue}
          formatValue={(value) => format(texts.share, { percent: Math.round(value) })}
        />
        <span className={styles.kpiLabel}>{dashboardTexts.kpi.resolved}</span>
      </div>
    </div>
  );
}
