import { Icon } from '../icons/Icon';
import styles from './CloseButton.module.css';

// Круглая кнопка «закрыть» у панелей карты и окон: при наведении крестик поворачивается.
// dataUi — имя для адаптаций (на тач-экранах кнопка растёт до тач-цели): 'panel-close' у панелей,
// 'modal-close' у окон.
export function CloseButton({ label, onClick, size = 'md', dataUi = 'panel-close' }) {
  return (
    <button
      type="button"
      className={`${styles.root} ${styles[size]}`}
      data-ui={dataUi}
      onClick={onClick}
      aria-label={label}
    >
      <Icon name="close" size={size === 'sm' ? 12 : 14} />
    </button>
  );
}
