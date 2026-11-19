import { TextField } from '@/shared/ui/controls/TextField';
import { Icon } from '@/shared/ui/icons/Icon';
import auth from '@/texts/en/auth.json';
import form from '../../AuthForm.module.css';
import styles from './AccountStep.module.css';

// Что даёт аккаунт — заполняет шаг email (тело шага держит одну высоту на всех шагах).
const PERKS = [
  { key: 'mood', icon: 'smile' },
  { key: 'problems', icon: 'pin-alert' },
  { key: 'privacy', icon: 'padlock' },
];

export function AccountStep({ values, errors, onChange }) {
  const texts = auth.register;
  return (
    <div className={form.fields}>
      <TextField
        label={auth.fields.email}
        type="email"
        autoComplete="email"
        value={values.email}
        onChange={(event) => onChange('email', event.target.value)}
        error={errors.email}
        hint={texts.emailHint}
      />
      <ul className={styles.perks} aria-label={texts.perksLabel}>
        {PERKS.map((perk) => (
          <li key={perk.key} className={styles.perk}>
            <Icon name={perk.icon} className={styles.perkIcon} />
            {texts.perks[perk.key]}
          </li>
        ))}
      </ul>
    </div>
  );
}
