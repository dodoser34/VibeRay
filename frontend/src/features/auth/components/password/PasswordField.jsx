import { useState } from 'react';
import { TextField } from '@/shared/ui/controls/TextField';
import auth from '@/texts/en/auth.json';
import { Icon } from '@/shared/ui/icons/Icon';
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
          onClick={() => setVisible((wasVisible) => !wasVisible)}
        >
          <Icon name={visible ? 'eye' : 'eye-off'} size={18} />
        </button>
      }
    />
  );
}
