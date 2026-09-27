import { PROBLEM_STATUSES } from '@/shared/config/problemStatuses';
import { format } from '@/shared/lib/format';
import { percentOf } from '@/shared/lib/formatNumber';
import texts from '@/texts/stats.json';
import { Breakdown } from './Breakdown';

export function StatusBreakdown({ byStatus, total, label = texts.statusesLabel }) {
  return (
    <Breakdown
      label={label}
      items={PROBLEM_STATUSES.map((status) => ({
        key: status.code,
        label: status.label,
        value: byStatus[status.code] ?? 0,
        colorVar: status.colorVar,
        note: format(texts.categoryShare, {
          count: byStatus[status.code] ?? 0,
          percent: percentOf(byStatus[status.code] ?? 0, total),
        }),
      }))}
    />
  );
}
