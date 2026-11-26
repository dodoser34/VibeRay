import { useRef } from 'react';
import { useSlidingThumb } from '@/shared/animations/controls/useSlidingThumb';
import styles from './OptionGroup.module.css';

// Группа вариантов, из которых выбран один (тема в настройках). options — [{ code, label, icon? }];
// рамка акцента перетекает к выбранному варианту (useSlidingThumb).
export function OptionGroup({ label, options, value, onChange }) {
  const rootRef = useRef(null);
  const thumbRef = useRef(null);
  useSlidingThumb(rootRef, thumbRef, value, '[aria-pressed="true"]');

  return (
    <div ref={rootRef} className={styles.group} role="group" aria-label={label}>
      <span ref={thumbRef} className={styles.thumb} aria-hidden="true" />
      {options.map((option) => (
        <button
          key={option.code}
          type="button"
          className={styles.option}
          aria-pressed={option.code === value}
          onClick={() => onChange(option.code)}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}
