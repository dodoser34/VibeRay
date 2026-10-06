import styles from './OptionGroup.module.css';

// Группа вариантов, из которых выбран один (настройки: тема, графика). options — [{ code, label,
// icon? }]; выбранный вариант — в рамке акцента.
export function OptionGroup({ label, options, value, onChange }) {
  return (
    <div className={styles.group} role="group" aria-label={label}>
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
