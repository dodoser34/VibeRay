import { useState } from 'react';
import { useAuth } from '@/features/auth';
import { updateProfile } from '@/shared/api/endpoints/users';
import { useSaveAction } from '../hooks/useSaveAction';
import { SaveBar } from './SaveBar';
import { SettingsSection } from './SettingsSection';
import texts from '@/texts/ru/settings.json';
import styles from './DistrictSection.module.css';

// «Свой район» приватный: он только выбирает, какой район карта откроет первым.
// districts: [{ slug, name }] или null, пока город грузится.
export function DistrictSection({ id, districts }) {
  const { user, updateUser } = useAuth();
  const save = useSaveAction();
  const saved = user.home_district ?? null;
  const [district, setDistrict] = useState(saved);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const outcome = await save.run(() => updateProfile({ homeDistrict: district }));
    if (outcome.ok) updateUser(outcome.result);
  };

  const option = (slug, name) => (
    <label key={slug ?? 'none'} className={styles.option} data-none={slug === null || undefined}>
      <input
        type="radio"
        name="home-district"
        className="visually-hidden"
        checked={district === slug}
        onChange={() => setDistrict(slug)}
      />
      <span>{name}</span>
    </label>
  );

  return (
    <SettingsSection id={id} title={texts.sections.district} lead={texts.district.lead}>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <fieldset className={styles.choices}>
          <legend className="visually-hidden">{texts.district.legend}</legend>
          {districts ? (
            <div className={styles.grid} data-ui="settings-district-grid">
              {option(null, texts.district.none)}
              {districts.map((d) => option(d.slug, d.name))}
            </div>
          ) : (
            <p className={styles.loading}>{texts.district.loading}</p>
          )}
        </fieldset>
        <SaveBar
          status={save.status}
          error={save.error?.message}
          dirty={district !== saved}
          saveLabel={texts.district.save}
          onReset={() => setDistrict(saved)}
        />
      </form>
    </SettingsSection>
  );
}
