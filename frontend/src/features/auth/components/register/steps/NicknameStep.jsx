import { TextField } from '@/shared/ui/controls/TextField';
import auth from '@/texts/en/auth.json';
import form from '../../AuthForm.module.css';
import styles from './NicknameStep.module.css';

// Ник и готовые идеи в один клик (все подходят под NICKNAME_PATTERN).
export function NicknameStep({ values, errors, onChange }) {
  const texts = auth.register;
  return (
    <div className={form.fields}>
      <TextField
        label={auth.fields.nickname}
        autoComplete="nickname"
        maxLength={24}
        value={values.nickname}
        onChange={(event) => onChange('nickname', event.target.value)}
        error={errors.nickname}
        hint={texts.nicknameHint}
      />
      <div className={styles.ideas}>
        <span className={styles.ideasLabel}>{texts.ideasLabel}</span>
        {texts.nicknameIdeas.map((idea) => (
          <button
            key={idea}
            type="button"
            className={styles.idea}
            data-active={values.nickname === idea || undefined}
            onClick={() => onChange('nickname', idea)}
          >
            {idea}
          </button>
        ))}
      </div>
    </div>
  );
}
