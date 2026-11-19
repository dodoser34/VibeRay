import { format } from '@/shared/lib/i18n/format';
import { Avatar, AVATAR_PRESETS } from '@/shared/ui/avatar/Avatar';
import auth from '@/texts/en/auth.json';
import form from '../../AuthForm.module.css';
import styles from './AvatarStep.module.css';

export function AvatarStep({ values, onChange }) {
  const texts = auth.register;
  return (
    <fieldset className={form.choices}>
      <legend className={form.legend}>{texts.avatarLegend}</legend>
      <div className={styles.avatarGrid}>
        {AVATAR_PRESETS.map((_, i) => {
          const src = `preset:${i}`;
          return (
            <label key={src} className={styles.avatarOption}>
              <input
                type="radio"
                name="avatar"
                className="visually-hidden"
                checked={values.avatar === src}
                onChange={() => onChange('avatar', src)}
              />
              <Avatar src={src} size={48} label={format(texts.avatarOption, { number: i + 1 })} />
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
