import { CityPicker } from '@/shared/ui/cityPicker/CityPicker';
import auth from '@/texts/en/auth.json';
import form from '../../AuthForm.module.css';

// Свой город — обязательный шаг: от него зависят районы следующего шага и город, который карта
// откроет первым. cities — [{ slug, name, country }] или null, пока список грузится.
export function CityStep({ cities, value, error, onChoose }) {
  const texts = auth.register;
  return (
    <fieldset className={form.choices}>
      <legend className={form.legend}>{texts.cityLegend}</legend>
      <p className={form.note}>{texts.cityNote}</p>
      <CityPicker
        cities={cities}
        value={value}
        onChange={onChoose}
        label={texts.cityLegend}
        error={error}
      />
    </fieldset>
  );
}
