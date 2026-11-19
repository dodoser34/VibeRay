import { useRef } from 'react';
import { useSlidingThumb } from '@/shared/animations/controls/useSlidingThumb';
import styles from './FilterChoice.module.css';

// Переключатель-кнопки (город, слой, показатель): рамка выбора перетекает к нажатой кнопке
// (useSlidingThumb), нажатая кнопка пружинит (shared/animations/controls/pressFeedback).
// wrap — длинные подписи переносятся на вторую строку (города в три колонки).
export function FilterChoice({ options, value, onChange, label, columns = options.length, wrap }) {
  const rootRef = useRef(null);
  const thumbRef = useRef(null);
  useSlidingThumb(rootRef, thumbRef, value);

  return (
    <div
      ref={rootRef}
      className={styles.choices}
      style={{ '--count': columns }}
      data-wrap={wrap || undefined}
      role="radiogroup"
      aria-label={label}
    >
      <span ref={thumbRef} className={styles.choiceThumb} aria-hidden="true" />
      {options.map(([code, text]) => (
        <button
          key={code}
          type="button"
          role="radio"
          aria-checked={value === code}
          className={styles.choice}
          data-ui="map-choice"
          onClick={() => onChange(code)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
