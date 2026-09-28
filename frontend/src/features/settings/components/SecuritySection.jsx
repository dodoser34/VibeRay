import { useState } from 'react';
import { PasswordField, PasswordStrength, useAuth } from '@/features/auth';
import { changePassword } from '@/shared/api/endpoints/users';
import { evaluatePassword } from '@/shared/lib/passwordStrength';
import { useSaveAction } from '../hooks/useSaveAction';
import { SaveBar } from './SaveBar';
import { SettingsSection } from './SettingsSection';
import auth from '@/texts/ru/auth.json';
import texts from '@/texts/ru/settings.json';
import styles from './SecuritySection.module.css';

const EMPTY = { current: '', next: '', repeat: '' };
// Ошибки API, которые показываются у своего поля, а не под кнопкой.
const FIELD_OF = { wrong_password: 'current', weak_password: 'next' };

function validate(values, user) {
  const errors = {};
  if (!values.current) errors.current = auth.errors.passwordEmpty;
  if (!evaluatePassword(values.next, user).acceptable) errors.next = auth.errors.passwordWeak;
  else if (values.next === values.current) errors.next = texts.security.same;
  if (values.repeat !== values.next) errors.repeat = auth.errors.passwordsDiffer;
  return errors;
}

export function SecuritySection({ id }) {
  const { user } = useAuth();
  const save = useSaveAction();
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});

  const set = (field) => (event) => {
    setValues((v) => ({ ...v, [field]: event.target.value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const found = validate(values, user);
    setErrors(found);
    if (Object.keys(found).length) return;
    const outcome = await save.run(() =>
      changePassword({ currentPassword: values.current, newPassword: values.next }),
    );
    if (outcome.ok) setValues(EMPTY);
    else if (FIELD_OF[outcome.error.code]) {
      setErrors({ [FIELD_OF[outcome.error.code]]: outcome.error.message });
    }
  };

  const strength = evaluatePassword(values.next, user);

  return (
    <SettingsSection id={id} title={texts.sections.security} lead={texts.security.lead}>
      <div className={styles.email}>
        <span className={styles.emailLabel}>{texts.security.emailLabel}</span>
        <span className={styles.emailValue}>{user.email}</span>
        <span className={styles.private}>
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
            <path d="M4 7V5a4 4 0 0 1 8 0v2M3 7h10v7H3z" />
          </svg>
          {texts.security.emailPrivate}
        </span>
      </div>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <h3 className={styles.subtitle}>{texts.security.passwordTitle}</h3>
        {/* Скрытое поле логина: менеджер паролей понимает, для какого аккаунта новый пароль */}
        <input
          type="email"
          className="visually-hidden"
          autoComplete="username"
          value={user.email}
          readOnly
          tabIndex={-1}
          aria-hidden="true"
        />
        <div className={styles.fields} data-ui="settings-password-fields">
          <PasswordField
            label={texts.security.current}
            autoComplete="current-password"
            value={values.current}
            onChange={set('current')}
            error={errors.current}
          />
          <PasswordField
            label={texts.security.next}
            autoComplete="new-password"
            value={values.next}
            onChange={set('next')}
            error={errors.next}
          />
          <PasswordField
            label={texts.security.repeat}
            autoComplete="new-password"
            value={values.repeat}
            onChange={set('repeat')}
            error={errors.repeat}
          />
        </div>
        {values.next && <PasswordStrength result={strength} />}
        <SaveBar
          status={save.status}
          error={save.error && !FIELD_OF[save.error.code] ? save.error.message : ''}
          dirty={Boolean(values.current || values.next || values.repeat)}
          saveLabel={texts.security.save}
          savedLabel={texts.security.changed}
        />
      </form>
    </SettingsSection>
  );
}
