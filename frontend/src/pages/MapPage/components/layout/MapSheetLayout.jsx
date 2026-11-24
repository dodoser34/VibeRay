import { rootScale, useViewport } from '@/adaptations/core';
import { FilterChip } from '@/adaptations/mobile/components/map/FilterChip';
import { MapFab } from '@/adaptations/mobile/components/map/MapFab';
import { BottomSheet } from '@/adaptations/mobile/components/sheet/BottomSheet';
import { MoodFace } from '@/features/mood';
import { Icon } from '@/shared/ui/icons/Icon';
import texts from '@/texts/en/map.json';
import styles from './MapSheetLayout.module.css';

// Раскладка «шторка» (телефоны, планшеты стоя): карта на весь экран, фильтры свёрнуты в чип,
// действия — в кнопке «+», содержимое (район, проблема, дашборд) — в шторке снизу.
// content — что сейчас в шторке: пока ставят метку проблемы, шторка опускается ниже.
export function MapSheetLayout({
  filters,
  filterSummary,
  detail,
  content,
  isStats,
  report,
  snap,
  onSnapChange,
  onInset,
  onRecenter,
  onMarkMood,
  onReportProblem,
  onOpenStats,
}) {
  const { phoneNav } = useViewport();
  const unit = 16 * rootScale();
  const actions = isStats
    ? []
    : [
        {
          key: 'mood',
          primary: true,
          label: texts.actions.markMood,
          hint: texts.fab.markMoodHint,
          icon: <MoodFace mood="good" size={24} label="" />,
          onSelect: onMarkMood,
        },
        {
          key: 'problem',
          label: texts.actions.reportProblem,
          hint: texts.fab.reportHint,
          icon: <Icon name="pin" size={22} className={styles.icon} />,
          onSelect: onReportProblem,
        },
        {
          key: 'stats',
          label: texts.statsLink.open,
          hint: texts.fab.statsHint,
          icon: <Icon name="stats" size={16} className={styles.icon} />,
          onSelect: onOpenStats,
        },
      ];

  return (
    <>
      <FilterChip summary={filterSummary}>{filters}</FilterChip>
      <MapFab actions={actions} onRecenter={onRecenter} hidden={snap === 'full' || report} />
      <BottomSheet
        snap={snap}
        onSnapChange={onSnapChange}
        onInset={onInset}
        label={texts.sheet.label}
        toggleLabel={texts.sheet.toggle}
        peek={Math.round((content === 'report:place' ? 15 : 6) * unit)}
        top={Math.round((phoneNav ? 4.5 : 5.75) * unit)}
      >
        {detail}
      </BottomSheet>
    </>
  );
}
