import { useRevealed } from '@/shared/hooks/useRevealed';
import styles from './StackedBar.module.css';

// Доли целого в одной скруглённой полоске: segments: [{ key, value, colorVar }]. Сегменты двигаются
// только через transform, поэтому скругления не сплющиваются; пустые сегменты не занимают места и
// не оставляют лишних щелей. В первом кадре части растут слева, при обновлении — плавно переезжают.
export function StackedBar({ segments, label, height = 8 }) {
  const revealed = useRevealed();
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const shares = segments.map((segment) => (total > 0 ? segment.value / total : 0));
  const parts = segments.map((segment, i) => ({
    ...segment,
    share: shares[i],
    offset: shares.slice(0, i).reduce((sum, share) => sum + share, 0),
  }));
  const dividers = parts.filter(
    (part, i) => part.share > 0 && parts.slice(0, i).some((p) => p.share > 0),
  );

  return (
    <div
      className={styles.root}
      role="img"
      aria-label={label}
      style={{ '--height': `${height}px` }}
    >
      {parts.map((part, i) => (
        <span
          key={part.key}
          className={styles.segment}
          style={{
            '--offset': revealed ? part.offset : 0,
            '--share': revealed ? part.share : 0,
            '--i': i,
            background: `var(${part.colorVar})`,
          }}
        />
      ))}
      {dividers.map((part) => (
        <span
          key={`cut-${part.key}`}
          className={styles.divider}
          style={{ '--offset': revealed ? part.offset : 0 }}
        />
      ))}
    </div>
  );
}
