import { evaluatePassword } from '@/shared/lib/passwordStrength';
import auth from '@/texts/en/auth.json';
import { PasswordField } from '../../password/PasswordField';
import { PasswordStrength } from '../../password/PasswordStrength';
import form from '../../AuthForm.module.css';

export function PasswordStep({ values, errors, onChange }) {
  return (
    <div className={form.fields}>
      <PasswordField
        label={auth.fields.password}
        autoComplete="new-password"
        value={values.password}
        onChange={(event) => onChange('password', event.target.value)}
        error={errors.password}
      />
      {values.password && <PasswordStrength result={evaluatePassword(values.password, values)} />}
      <PasswordField
        label={auth.fields.passwordRepeat}
        autoComplete="new-password"
        value={values.confirm}
        onChange={(event) => onChange('confirm', event.target.value)}
        error={errors.confirm}
      />
    </div>
  );
}
