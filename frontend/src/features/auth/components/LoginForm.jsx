import { useRef, useState } from 'react';
import { USE_MOCKS } from '@/shared/api/client';
import { gsap } from '@/shared/animations/core/gsapSetup';
import { EMAIL_PATTERN } from '@/shared/config/validation';
import { Button } from '@/shared/ui/controls/Button';
import { TextField } from '@/shared/ui/controls/TextField';
import { useAuth } from '../model/useAuth';
import { PasswordField } from './password/PasswordField';
import { DEMO_ACCOUNTS } from '@/demo-data/demoLogin';
import auth from '@/texts/en/auth.json';
import form from './AuthForm.module.css';
import styles from './LoginForm.module.css';

// Подсказка демо-входа — только в демо-режиме (без бэкенда); список — demo-data/demoLogin.js.
export function LoginForm({ onSuccess, onSwitch }) {
  const { login } = useAuth();
  const formRef = useRef(null);
  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (field) => (event) => {
    setValues((current) => ({ ...current, [field]: event.target.value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
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
    <form ref={formRef} className={form.form} onSubmit={handleSubmit} noValidate>
      <div className={form.intro} data-part>
        <h2 className={form.title}>{auth.login.title}</h2>
        <p className={form.lead} data-ui="auth-login-lead">
          {auth.login.lead}
        </p>
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
        <p className={form.formError} role="alert">
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

      <p className={form.switch} data-part>
        {auth.login.noAccount}{' '}
        <Button variant="text" onClick={onSwitch}>
          {auth.login.toRegister}
        </Button>
      </p>
    </form>
  );
}
