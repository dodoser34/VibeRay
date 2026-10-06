import { useId, useState } from 'react';
import { REJECTION_REASONS } from '@/shared/config/problemStatuses';
import { Button } from '@/shared/ui/controls/Button';
import texts from '@/texts/ru/moderation.json';
import styles from './RejectForm.module.css';

// Отклонение: причина обязательна; для дубля — номер исходной проблемы, автор получит ссылку на неё.
export function RejectForm({ loading, onSubmit, onCancel }) {
  const name = useId();
  const [reason, setReason] = useState('spam');
  const [duplicateOf, setDuplicateOf] = useState('');

  const submit = (event) => {
    event.preventDefault();
    onSubmit({
      reason,
      duplicateOf: reason === 'duplicate' && duplicateOf.trim() ? duplicateOf.trim() : undefined,
    });
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <fieldset className={styles.reasons}>
        <legend>{texts.queue.reject.legend}</legend>
        {REJECTION_REASONS.map(({ code, label }) => (
          <label key={code} className={styles.reason}>
            <input
              type="radio"
              name={name}
              value={code}
              checked={reason === code}
              onChange={() => setReason(code)}
            />
            {label}
          </label>
        ))}
      </fieldset>
      {reason === 'duplicate' && (
        <label className={styles.duplicate}>
          <span>{texts.queue.reject.duplicateOf}</span>
          <input
            value={duplicateOf}
            onChange={(e) => setDuplicateOf(e.target.value)}
            placeholder={texts.queue.reject.duplicatePlaceholder}
            spellCheck={false}
          />
          <small>{texts.queue.reject.duplicateHint}</small>
        </label>
      )}
      <div className={styles.actions}>
        <Button type="submit" variant="danger" size="sm" loading={loading}>
          {texts.queue.reject.confirm}
        </Button>
        <Button variant="text" onClick={onCancel}>
          {texts.queue.reject.cancel}
        </Button>
      </div>
    </form>
  );
}
