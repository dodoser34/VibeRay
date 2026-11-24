import auth from '@/texts/en/auth.json';
import form from '../../AuthForm.module.css';
import styles from './DistrictStep.module.css';

// Свой район в выбранном на прошлом шаге городе — необязательный шаг; выбор сразу подсвечивается
// на главной (onChoose). districts — [{ slug, name }] или null, пока районы города грузятся.
export function DistrictStep({ districts, value, onChoose }) {
  const texts = auth.register;
  return (
    <fieldset className={form.choices}>
      <legend className={form.legend}>{texts.districtLegend}</legend>
      <p className={form.note}>{texts.districtNote}</p>
      {!districts && <p className={form.note}>{texts.districtLoading}</p>}
      <div className={styles.districtGrid}>
        {(districts ?? []).map((district) => (
          <label key={district.slug} className={styles.districtOption}>
            <input
              type="radio"
              name="district"
              className="visually-hidden"
              checked={value === district.slug}
              onChange={() => onChoose(district.slug)}
            />
            <span>{district.name}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
