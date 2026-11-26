import { MoodFace } from '@/features/mood';
import { moodCodeForScore } from '@/shared/config/moods';
import { CATEGORY_BY_CODE } from '@/shared/config/problemCategories';
import styles from './MapTooltip.module.css';

// Подсказка у курсора над районом (настроение, название, значение показателя дашборда) или над
// меткой проблемы (категория и район). Положение задаёт useFollowTooltip через ref.
export function MapTooltip({ ref, hover, mood, value, names }) {
  return (
    <div ref={ref} className={styles.tooltip} role="tooltip">
      {hover.kind === 'district' ? (
        <>
          <MoodFace
            mood={mood && !mood.insufficient_data ? moodCodeForScore(mood.score) : null}
            size={22}
            label=""
          />
          <span>{names[hover.slug] ?? ''}</span>
          {value && <span className={styles.value}>{value}</span>}
        </>
      ) : (
        <span>
          {CATEGORY_BY_CODE[hover.problem.category].label} · {names[hover.problem.district] ?? ''}
        </span>
      )}
    </div>
  );
}
