import { useState } from 'react';
import { PasswordField } from '@/features/auth';
import { deleteAccount } from '@/shared/api/endpoints/users';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import auth from '@/texts/ru/auth.json';
import texts from '@/texts/ru/settings.json';
import styles from './DeleteAccountDialog.module.css';

// Удаление необратимо: пароль ещё раз, пока идёт запрос — диалог не закрыть.
export function DeleteAccountDialog({ onClose, onDeleted }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!password) {
      setError(auth.errors.passwordEmpty);
      return;
    }
    setBusy(true);
    try {
      await deleteAccount({ password });
      await onDeleted();
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  };

  return (
    <Modal title={texts.account.confirmTitle} onClose={busy ? () => {} : onClose}>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <p className={styles.text}>{texts.account.confirmText}</p>
        <PasswordField
          label={texts.account.confirmPassword}
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError('');
          }}
          error={error}
        />
        <div className={styles.actions}>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {texts.account.cancel}
          </Button>
          <Button type="submit" variant="danger" loading={busy}>
            {texts.account.confirm}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
