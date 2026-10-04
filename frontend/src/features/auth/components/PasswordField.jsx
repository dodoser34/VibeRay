import { useState } from 'react';
import { TextField } from '@/shared/ui/TextField';
import auth from '@/texts/ru/auth.json';
import styles from './PasswordField.module.css';
import { Icon } from '@/shared/ui/Icon';

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
          <Icon name={visible ? 'eye' : 'eye-off'} size={18} />
        </button>
      }
    />
  );
}
