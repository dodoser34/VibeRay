import { useRef, useState } from 'react';
import { USE_MOCKS } from '@/shared/api/client';
import { gsap } from '@/shared/animations/gsapSetup';
import { EMAIL_PATTERN } from '@/shared/config/validation';
import { Button } from '@/shared/ui/controls/Button';
import { TextField } from '@/shared/ui/controls/TextField';
import { useAuth } from '../model/useAuth';
import { PasswordField } from './PasswordField';
import demoAccounts from '@/demo-data/accounts.json';
import auth from '@/texts/ru/auth.json';
import styles from './PassForms.module.css';

// Подсказка демо-входа видна только в демо-режиме (без бэкенда): житель, модератор и новичок —
// житель без сообщений и уведомлений, чтобы были видны пустые состояния. label — ключ подписи в
// texts/<язык>/auth.json (читается при рендере: язык меняется на лету).
const DEMO_ACCOUNTS = [
  { id: 'u-user', label: 'demoResident' },
  { id: 'u-moderator', label: 'demoModerator' },
  { id: 'u-newbie', label: 'demoNewcomer' },
].map(({ id, label }) => {
  const account = demoAccounts.find(({ user }) => user.id === id);
  return { id, label, email: account.user.email, password: account.password };
});

export function LoginForm({ onSuccess, onSwitch }) {
  const { login } = useAuth();
  const formRef = useRef(null);
  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (field) => (event) => {
    setValues((v) => ({ ...v, [field]: event.target.value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
    setFormError('');
  };

  const shake = () =>
    gsap.fromTo(formRef.current, { x: -8 }, { x: 0, duration: 0.5, ease: 'elastic.out(1.2, 0.3)' });

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!EMAIL_PATTERN.test(values.email)) nextErrors.email = auth.errors.emailTypo;
    if (!values.password) nextErrors.password = auth.errors.passwordEmpty;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return shake();

    setLoading(true);
    try {
      onSuccess(await login(values));
    } catch (error) {
      setFormError(error.message);
      shake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <form ref={formRef} className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.intro} data-part>
        <h2 className={styles.title}>{auth.login.title}</h2>
        <p className={styles.lead}>{auth.login.lead}</p>
      </div>

      <div data-part>
        <TextField
          label={auth.fields.email}
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={update('email')}
          error={errors.email}
        />
      </div>
      <div data-part>
        <PasswordField
          label={auth.fields.password}
          autoComplete="current-password"
          value={values.password}
          onChange={update('password')}
          error={errors.password}
        />
      </div>

      {formError && (
        <p className={styles.formError} role="alert">
          {formError}
        </p>
      )}

      <div data-part>
        <Button type="submit" size="lg" block loading={loading}>
          {auth.login.submit}
        </Button>
      </div>

      {USE_MOCKS && (
        <div className={styles.demo} data-part>
          <p className={styles.demoTitle}>{auth.login.demoTitle}</p>
          <ul className={styles.demoList}>
            {DEMO_ACCOUNTS.map(({ id, label, email, password }) => (
              <li key={id} className={styles.demoItem}>
                <span className={styles.demoRole}>{auth.login[label]}</span>
                <Button variant="text" onClick={() => setValues({ email, password })}>
                  {auth.login.demoFill}
                </Button>
                <span className={styles.demoCredentials}>
                  {email} · {password}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className={styles.switch} data-part>
        {auth.login.noAccount}{' '}
        <Button variant="text" onClick={onSwitch}>
          {auth.login.toRegister}
        </Button>
      </p>
    </form>
  );
}
