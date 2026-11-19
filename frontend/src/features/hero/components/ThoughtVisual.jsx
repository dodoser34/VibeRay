import { MoodFace } from '@/features/mood';
import { CategoryIcon } from '@/features/problems';
import { formatNumber } from '@/shared/lib/i18n/formatNumber';
import { Avatar } from '@/shared/ui/avatar/Avatar';
import { Icon } from '@/shared/ui/icons/Icon';
import styles from './ThoughtVisual.module.css';

const ASK_MOODS = ['very_bad', 'bad', 'normal', 'good', 'excellent'];
// Доли настроений в полосе района — от лучшего к худшему (токены --mood-*).
const DISTRICT_BAR = [
  ['--mood-excellent', 34],
  ['--mood-good', 28],
  ['--mood-normal', 20],
  ['--mood-anxious', 11],
  ['--mood-bad', 7],
];

// Картинка внутри облачка мысли (вид — thought.kind, см. THOUGHTS в HeroThoughts); data-атрибуты —
// цели анимаций HeroThoughts.

// Узкое облачко (одна колонка): пять лиц шкалы помещаются в строку только мельче.
export function ThoughtVisual({ thought, stacked }) {
  if (thought.kind === 'ask') {
    return (
      <span className={styles.faces} data-stacked={stacked || undefined}>
        {ASK_MOODS.map((mood) => (
          <span key={mood} data-face>
            <MoodFace mood={mood} size={stacked ? 20 : 26} label="" />
          </span>
        ))}
      </span>
    );
  }
  if (thought.kind === 'joy') {
    return (
      <span className={styles.joy} data-face>
        <MoodFace mood={thought.mood} size={44} label="" />
      </span>
    );
  }
  if (thought.kind === 'solved') {
    return (
      <span className={styles.solved}>
        <CategoryIcon category={thought.category} size={22} />
        <span className={styles.check} data-check>
          <Icon name="check" size={12} strokeWidth={3} />
        </span>
      </span>
    );
  }
  if (thought.kind === 'confirm') {
    return (
      <span className={styles.crowd}>
        {thought.avatars.map((preset) => (
          <span key={preset} className={styles.avatar} data-avatar>
            <Avatar src={`preset:${preset}`} size={28} />
          </span>
        ))}
        <span className={styles.count} data-count>
          +{formatNumber(thought.count)}
        </span>
      </span>
    );
  }
  return (
    <span className={styles.bar}>
      {DISTRICT_BAR.map(([token, share]) => (
        <span
          key={token}
          className={styles.segment}
          data-segment
          style={{ flexGrow: share, background: `var(${token})` }}
        />
      ))}
    </span>
  );
}
