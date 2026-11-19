import { MoodFace } from '@/features/mood';
import { MOOD_BY_CODE, moodCodeForScore } from '@/shared/config/moods';
import { format } from '@/shared/lib/i18n/format';
import { formatNumber, formatSigned } from '@/shared/lib/i18n/formatNumber';
import { plural } from '@/shared/lib/i18n/plural';
import texts from '@/texts/en/stats.json';
import styles from './MoodSummary.module.css';

// Разница меньше этой читается как «так же» (оценки в диапазоне −2…+2).
const SAME_SCORE = 0.1;

// Настроение района за период: лицо, оценка, число отметок и сравнение со средним по городу.

export function MoodSummary({ mood, period, cityAverage }) {
  if (mood.insufficient_data) {
    return (
      <div className={styles.mood}>
        <MoodFace mood={null} size={64} />
        <div>
          <p className={styles.moodLabel}>{texts.fewMarks}</p>
          <p className={styles.moodMeta}>{texts.fewMarksNote}</p>
        </div>
      </div>
    );
  }
  const code = moodCodeForScore(mood.score);
  const delta = cityAverage === null ? null : mood.score - cityAverage;
  let compare = null;
  if (delta !== null) {
    if (Math.abs(delta) < SAME_SCORE) compare = texts.compare.same;
    else
      compare = format(delta > 0 ? texts.compare.above : texts.compare.below, {
        delta: Math.abs(delta).toFixed(1),
      });
  }
  return (
    <div className={styles.mood}>
      <MoodFace mood={code} size={64} />
      <div className={styles.moodText}>
        <p className={styles.moodLabel}>
          {MOOD_BY_CODE[code].label}
          <span className={styles.score}>{formatSigned(mood.score)}</span>
        </p>
        <p className={styles.moodMeta}>
          {format(texts.moodMeta, {
            count: formatNumber(mood.sample_size),
            marks: plural(mood.sample_size, texts.marks),
            period: texts.periods[period],
            mood: MOOD_BY_CODE[mood.dominant_mood].label.toLowerCase(),
          })}
        </p>
        {compare && (
          <p className={styles.compare} data-direction={delta > 0 ? 'up' : 'down'}>
            {compare}
          </p>
        )}
      </div>
    </div>
  );
}
