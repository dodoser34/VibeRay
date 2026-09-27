import { MOODS } from '@/shared/config/moods';
import { MoodFace } from './MoodFace';
import texts from '@/texts/mood.json';
import styles from './MoodLegend.module.css';

export function MoodLegend() {
  return (
    <div className={styles.root}>
      <div className={styles.scale} aria-hidden="true" />
      <ul className={styles.list}>
        {MOODS.map((mood) => (
          <li key={mood.code} className={styles.item}>
            <MoodFace mood={mood.code} size={22} label="" />
            <span>{mood.label}</span>
          </li>
        ))}
        <li className={styles.item}>
          <MoodFace mood={null} size={22} label="" />
          <span className={styles.muted}>{texts.legendNoData}</span>
        </li>
      </ul>
    </div>
  );
}
