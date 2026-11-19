import { MOOD_BY_CODE, moodCodeForScore } from '@/shared/config/moods';
import { format } from '@/shared/lib/i18n/format';
import { formatNumber, formatSigned } from '@/shared/lib/i18n/formatNumber';
import { plural } from '@/shared/lib/i18n/plural';
import texts from '@/texts/en/stats.json';
import { seriesPointTitle } from '../../lib/seriesLabels';

// Подсказка к точке графика настроения: дата, настроение, отметки, новые проблемы.

export function MoodPointDetails({ point, period }) {
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
