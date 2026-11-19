import { format } from '@/shared/lib/i18n/format';
import texts from '@/texts/en/map.json';
import { HEIGHT_SCALE } from '../../lib/heightScale';
import { FilterGroup } from './FilterGroup';
import { FilterLabel } from './FilterLabel';
import styles from './HeightScaleControl.module.css';

// Множитель высоты районов: 0 — плоская карта, дальше — во сколько раз вытянуть разницу настроений.
export function HeightScaleControl({ value, onChange, withHint }) {
  const shown = value === 0 ? texts.heightScale.flat : format(texts.heightScale.value, { value });
  return (
    <FilterGroup
      dataUi="map-filters-height"
      hint={withHint ? texts.heightScale.hint : null}
      hintDataUi="map-filters-height-hint"
    >
      <label className={styles.head}>
        <FilterLabel>{texts.heightScale.label}</FilterLabel>
        <output className={styles.value}>{shown}</output>
        <input
          type="range"
          className={styles.range}
          min={HEIGHT_SCALE.min}
          max={HEIGHT_SCALE.max}
          step={HEIGHT_SCALE.step}
          value={value}
          aria-valuetext={shown}
          style={{ '--fill': `${(value / HEIGHT_SCALE.max) * 100}%` }}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </label>
    </FilterGroup>
  );
}
