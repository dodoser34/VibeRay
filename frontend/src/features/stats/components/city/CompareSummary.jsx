import { MoodFace } from '@/features/mood';
import { MOOD_BY_CODE, moodCodeForScore } from '@/shared/config/moods';
import { format } from '@/shared/lib/i18n/format';
import { formatNumber, formatSigned } from '@/shared/lib/i18n/formatNumber';
import { plural } from '@/shared/lib/i18n/plural';
import texts from '@/texts/en/stats.json';
import styles from './CompareSummary.module.css';

const compareTexts = texts.districtCompare;

// Карточка одного района в сравнении: настроение, отметки и сообщения за период.
export function CompareSummary({ side, stats, name }) {
  const mood = stats?.mood;
  const code = mood && !mood.insufficient_data ? moodCodeForScore(mood.score) : null;
  return (
    <div className={styles.card} style={{ '--tone': `var(${side.colorVar})` }}>
      <MoodFace mood={code} size={40} />
      <div className={styles.cardText}>
        <span className={styles.cardName}>{name}</span>
        {!stats ? (
          <span className={styles.cardMeta}>{compareTexts.loading}</span>
        ) : (
          <>
            <span className={styles.cardScore}>
              {code ? formatSigned(mood.score) : texts.table.noData}
              {code && <span className={styles.cardMood}>{MOOD_BY_CODE[code].label}</span>}
            </span>
            <span className={styles.cardMeta}>
              {format(compareTexts.marks, {
                count: formatNumber(mood.sample_size),
                marks: plural(mood.sample_size, texts.marks),
              })}
              {' · '}
              {format(compareTexts.reported, {
                count: stats.problems.new_in_period,
                problems: plural(stats.problems.new_in_period, compareTexts.problemForms),
              })}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
