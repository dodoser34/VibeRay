import { useLayoutEffect, useRef } from 'react';
import { gsap } from '@/shared/animations/gsapSetup';
import { MOOD_PERIODS } from '@/shared/config/periods';
import texts from '@/texts/ru/mood.json';
import styles from './PeriodSwitch.module.css';

export function PeriodSwitch({
  value,
  onChange,
  options = MOOD_PERIODS,
  label = texts.periodLabel,
}) {
  const rootRef = useRef(null);
  const thumbRef = useRef(null);

  // Подсветка едет к выбранному варианту; когда переключатель меняет ширину (панель шире, окно
  // изменилось, догрузились шрифты), она без анимации встаёт на новое место варианта.
  useLayoutEffect(() => {
    const place = (duration) => {
      const active = rootRef.current.querySelector('[aria-checked="true"]');
      if (!active) return;
      gsap.to(thumbRef.current, {
        x: active.offsetLeft,
        width: active.offsetWidth,
        duration,
        ease: 'power3.out',
        overwrite: 'auto',
      });
    };
    place(0.45);
    const observer = new ResizeObserver(() => place(0));
    observer.observe(rootRef.current);
    return () => observer.disconnect();
  }, [value, options]);

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
