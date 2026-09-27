import { MOODS } from '@/shared/config/moods';
import { format } from '@/shared/lib/format';
import { percentOf } from '@/shared/lib/formatNumber';
import texts from '@/texts/stats.json';
import { Breakdown } from './Breakdown';

export function MoodDistribution({ distribution }) {
  const total = Object.values(distribution).reduce((a, b) => a + b, 0);
  return (
    <Breakdown
      label={texts.distributionLabel}
      items={MOODS.map((mood) => ({
        key: mood.code,
        label: mood.label,
        value: distribution[mood.code] ?? 0,
        colorVar: mood.colorVar,
        note: format(texts.share, { percent: percentOf(distribution[mood.code] ?? 0, total) }),
      }))}
    />
  );
}
