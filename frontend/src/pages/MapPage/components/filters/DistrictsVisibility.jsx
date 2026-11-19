import texts from '@/texts/en/map.json';
import { FilterChoice } from './FilterChoice';
import { FilterGroup } from './FilterGroup';

// Районы на карте или только карта дорог под ними.
export function DistrictsVisibility({ value, onChange }) {
  return (
    <FilterGroup
      label={texts.districtsVisibility.label}
      dataUi="map-filters-districts"
      hint={value ? null : texts.districtsVisibility.hint}
      hintDataUi="map-filters-districts-hint"
    >
      <FilterChoice
        label={texts.districtsVisibility.groupLabel}
        value={value ? 'show' : 'hide'}
        onChange={(code) => onChange(code === 'show')}
        options={[
          ['show', texts.districtsVisibility.show],
          ['hide', texts.districtsVisibility.hide],
        ]}
      />
    </FilterGroup>
  );
}
