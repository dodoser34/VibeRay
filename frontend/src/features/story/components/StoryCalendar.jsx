import { CALENDAR } from '../content';
import styles from './StoryCalendar.module.css';

// Сцена 7: пролистывается год работы, месяц за месяцем, с июля по июнь.
export function StoryCalendar() {
  return (
    <div className={styles.stack}>
      {CALENDAR.map((label, i) => (
        <div
          key={label}
          className={styles.sheet}
          data-story="sheet"
          data-later
          data-final={i >= CALENDAR.length - 2 || undefined}
        >
          <span className={styles.ring} aria-hidden="true" />
          <span className={styles.label}>{label}</span>
        </div>
      ))}
    </div>
  );
}
