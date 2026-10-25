import { useState } from 'react';
import { Button } from '../controls/Button';
import { Modal } from './Modal';
import styles from './ConfirmDialog.module.css';

// Подтверждение необратимого действия. Тексты передаёт тот, кто открывает диалог. onConfirm — async:
// пока он идёт, диалог не закрыть; ошибка сервера показывается здесь же, а не теряется.
export function ConfirmDialog({ title, text, confirmLabel, cancelLabel, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      await onConfirm();
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  };

  return (
    <Modal title={title} onClose={busy ? () => {} : onClose}>
      <div className={styles.body}>
        <p className={styles.text}>{text}</p>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <div className={styles.actions}>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant="danger" loading={busy} onClick={confirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
