import { FilterLabel } from './FilterLabel';
import styles from './FilterGroup.module.css';

// Группа фильтров карты: подпись группы, сами переключатели и необязательная подсказка под ними.
// dataUi / hintDataUi — значения data-ui для адаптаций (на планшете лёжа подсказки прячутся).
export function FilterGroup({ label, hint, dataUi, hintDataUi, className, children }) {
  return (
    <div className={className ? `${styles.group} ${className}` : styles.group} data-ui={dataUi}>
      {label && <FilterLabel>{label}</FilterLabel>}
      {children}
      {hint && (
        <p className={styles.hint} data-ui={hintDataUi}>
          {hint}
        </p>
      )}
    </div>
  );
}
