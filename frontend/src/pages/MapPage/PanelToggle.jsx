import styles from './PanelToggle.module.css';
import { Icon } from '@/shared/ui/Icon';

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
      <Icon name="chevron-left" size={14} />
    </button>
  );
}
