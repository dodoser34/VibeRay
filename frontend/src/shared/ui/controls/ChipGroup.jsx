import { useRef } from 'react';
import { useSlidingThumb } from '@/shared/animations/controls/useSlidingThumb';
import styles from './ChipGroup.module.css';

// Ряд чипов-фильтров, из которых выбран один (статусы очереди модератора, темы ответов). options —
// [{ code, label }]; рамка акцента перетекает к нажатому чипу и через перенос строки
// (useSlidingThumb). size: sm — компактные чипы панелей, md — обычные.
export function ChipGroup({ label, options, value, onChange, size = 'sm', optionDataUi }) {
  const rootRef = useRef(null);
  const thumbRef = useRef(null);
  useSlidingThumb(rootRef, thumbRef, value, '[aria-pressed="true"]');

  return (
    <div ref={rootRef} className={styles.group} role="group" aria-label={label}>
      <span ref={thumbRef} className={styles.thumb} aria-hidden="true" />
      {options.map((option) => (
        <button
          key={option.code ?? 'all'}
          type="button"
          className={`${styles.chip} ${styles[size]}`}
          aria-pressed={option.code === value}
          data-ui={optionDataUi}
          onClick={() => onChange(option.code)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
