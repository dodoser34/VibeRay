import styles from './PanelToggle.module.css';

// Язычок у внешнего края боковой панели: прячет её за край экрана и возвращает. Когда панель
// спрятана, язычок остаётся у края экрана.
export function PanelToggle({ side, hidden, controls, label, onToggle }) {
  return (
    <button
      type="button"
      className={styles.toggle}
      data-side={side}
      data-panel-toggle
      aria-expanded={!hidden}
      aria-controls={controls}
      aria-label={label}
      title={label}
      onClick={onToggle}
    >
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path d="M10 3.5 5.5 8l4.5 4.5" />
      </svg>
    </button>
  );
}
