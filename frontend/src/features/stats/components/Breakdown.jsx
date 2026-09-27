import { StackedBar } from '@/shared/ui/charts/StackedBar';
import styles from './Breakdown.module.css';

// Части целого: полоска из сегментов и легенда в две колонки.
// items: [{ key, label, value, colorVar, note }]
export function Breakdown({ label, items }) {
  return (
    <div className={styles.root}>
      <StackedBar label={label} segments={items} />
      <ul className={styles.legend} data-ui="breakdown-legend">
        {items.map((item) => (
          <li key={item.key} className={styles.item}>
            <span className={styles.dot} style={{ background: `var(${item.colorVar})` }} />
            <span className={styles.label}>{item.label}</span>
            <span className={styles.value}>{item.note}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
