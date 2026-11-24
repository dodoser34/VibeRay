import dictionaries from '@/texts/en/dictionaries.json';
import { withLabels } from './withLabels';

// Страны городов VibeRay (ISO 3166-1 alpha-2 — поле country в GET /cities). Порядок — порядок
// выбора страны в CityPicker.
export const COUNTRIES = withLabels(
  ['KZ', 'RU', 'DE', 'GB'].map((code) => ({ code })),
  dictionaries.countries,
);

export const COUNTRY_BY_CODE = Object.fromEntries(
  COUNTRIES.map((country) => [country.code, country]),
);
