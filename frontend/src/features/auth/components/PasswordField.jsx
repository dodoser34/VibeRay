import { useState } from 'react';
import { TextField } from '@/shared/ui/TextField';
import auth from '@/texts/ru/auth.json';
import styles from './PasswordField.module.css';

export function PasswordField(props) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      {...props}
      type={visible ? 'text' : 'password'}
      endSlot={
        <button
          type="button"
          className={styles.toggle}
          data-ui="password-toggle"
          aria-label={visible ? auth.fields.hidePassword : auth.fields.showPassword}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
            {!visible && <path d="M4 20L20 4" />}
          </svg>
        </button>
      }
    />
  );
}
