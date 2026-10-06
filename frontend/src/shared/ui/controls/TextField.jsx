import { useId } from 'react';
import styles from './TextField.module.css';

// Поле с плавающей подписью. Ошибки мягкие (без тревожного красного) и связаны с полем для экранных
// чтецов.
export function TextField({ label, error, hint, endSlot, className = '', ...inputProps }) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error || hint;
  return (
    <div
      className={`${styles.root} ${className}`}
      data-invalid={Boolean(error)}
      data-has-slot={Boolean(endSlot)}
    >
      {endSlot && <div className={styles.slot}>{endSlot}</div>}
      <input
        id={id}
        className={styles.input}
        placeholder=" "
        aria-invalid={Boolean(error)}
        aria-describedby={message ? messageId : undefined}
        {...inputProps}
      />
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {message && (
        <p id={messageId} className={error ? styles.error : styles.hint}>
          {message}
        </p>
      )}
    </div>
  );
}
