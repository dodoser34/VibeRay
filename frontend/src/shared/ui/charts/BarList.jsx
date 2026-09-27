import { useRevealed } from '@/shared/hooks/useRevealed';
import styles from './BarList.module.css';

// Подписанные горизонтальные полоски: items: [{ key, label, value, note }]. Заливка едет внутри
// скруглённой дорожки (translate, а не scale), поэтому скруглённый конец сохраняет форму при любой
// длине.
export function BarList({ items, max = Math.max(1, ...items.map((item) => item.value)) }) {
  const revealed = useRevealed();

  return (
    <ul className={styles.list}>
      {items.map((item, i) => (
        <li key={item.key} className={styles.item}>
          <span className={styles.label}>{item.label}</span>
          <span className={styles.note}>{item.note}</span>
          <span className={styles.track} aria-hidden="true">
            <span
              className={styles.fill}
              style={{ '--share': revealed ? item.value / max : 0, '--i': i }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}
