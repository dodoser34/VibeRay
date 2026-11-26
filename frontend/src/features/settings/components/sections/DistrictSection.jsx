import { useState } from 'react';
import { useAuth } from '@/features/auth';
import { updateProfile } from '@/shared/api/endpoints/users';
import { useCities, useCityDistricts } from '@/shared/hooks/useCities';
import { format } from '@/shared/lib/i18n/format';
import { CityPicker } from '@/shared/ui/cityPicker/CityPicker';
import texts from '@/texts/en/settings.json';
import { useSaveAction } from '../../hooks/useSaveAction';
import { SaveBar } from '../SaveBar';
import { SettingsSection } from '../SettingsSection';
import styles from './DistrictSection.module.css';

// «Свой город и район» приватные: они только выбирают, что карта откроет первым. Город — из всех
// городов VibeRay (поиск и страна), район — из районов выбранного города; новый город сбрасывает
// район.
export function DistrictSection({ id }) {
  const { user, updateUser } = useAuth();
  const save = useSaveAction();
  const saved = { city: user.home_city ?? null, district: user.home_district ?? null };
  const [home, setHome] = useState(saved);
  const cities = useCities();
  const districts = useCityDistricts(home.city);
  const cityName = cities?.find((city) => city.slug === home.city)?.name ?? '';

  const handleSubmit = async (event) => {
    event.preventDefault();
    const outcome = await save.run(() =>
      updateProfile({ homeCity: home.city, homeDistrict: home.district }),
    );
    if (outcome.ok) updateUser(outcome.result);
  };

  const chooseCity = (slug) =>
    setHome((current) => (current.city === slug ? current : { city: slug, district: null }));

  const option = (slug, name) => (
    <label key={slug ?? 'none'} className={styles.option} data-none={slug === null || undefined}>
      <input
        type="radio"
        name="home-district"
        className="visually-hidden"
        checked={home.district === slug}
        onChange={() => setHome((current) => ({ ...current, district: slug }))}
      />
      <span>{name}</span>
    </label>
  );

  return (
    <SettingsSection id={id} title={texts.sections.district} lead={texts.district.lead}>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <fieldset className={styles.choices}>
          <legend className={styles.legend}>{texts.district.cityLegend}</legend>
          <CityPicker
            cities={cities}
            value={home.city}
            onChange={chooseCity}
            label={texts.district.cityLegend}
          />
        </fieldset>

        {home.city && (
          <fieldset className={styles.choices}>
            <legend className={styles.legend}>
              {format(texts.district.districtLegend, { city: cityName })}
            </legend>
            {districts ? (
              <div className={styles.grid} data-ui="settings-district-grid">
                {option(null, texts.district.none)}
                {districts.map((district) => option(district.slug, district.name))}
              </div>
            ) : (
              <p className={styles.loading}>{texts.district.loading}</p>
            )}
          </fieldset>
        )}

        <SaveBar
          status={save.status}
          error={save.error?.message}
          dirty={home.city !== saved.city || home.district !== saved.district}
          saveLabel={texts.district.save}
          onReset={() => setHome(saved)}
        />
      </form>
    </SettingsSection>
  );
}
