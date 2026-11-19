import { useRef } from 'react';
import { useSlidingThumb } from '@/shared/animations/controls/useSlidingThumb';
import { MOOD_PERIODS } from '@/shared/config/periods';
import texts from '@/texts/en/mood.json';
import styles from './PeriodSwitch.module.css';

export function PeriodSwitch({
  value,
  onChange,
  options = MOOD_PERIODS,
  label = texts.periodLabel,
}) {
  const rootRef = useRef(null);
  const thumbRef = useRef(null);
  // Подложка перетекает к выбранному периоду (shared/animations/controls/useSlidingThumb).
  useSlidingThumb(rootRef, thumbRef, value);

  return (
    <div
      ref={rootRef}
      className={styles.root}
      role="radiogroup"
      aria-label={label}
      data-ui="period-switch"
    >
      <span ref={thumbRef} className={styles.thumb} aria-hidden="true" />
      {options.map((period) => (
        <button
          key={period.code}
          type="button"
          role="radio"
          aria-checked={value === period.code}
          className={styles.option}
          data-ui="period-option"
          onClick={() => onChange(period.code)}
        >
          {period.label}
        </button>
      ))}
    </div>
  );
}
