import { useId, useMemo, useState } from 'react';
import { COUNTRIES, COUNTRY_BY_CODE } from '@/shared/config/countries';
import { format } from '@/shared/lib/i18n/format';
import { ChipGroup } from '@/shared/ui/controls/ChipGroup';
import { Icon } from '@/shared/ui/icons/Icon';
import common from '@/texts/en/common.json';
import { CountryFlag } from './CountryFlag';
import styles from './CityPicker.module.css';

// Поиск без учёта регистра и диакритики: «koln» находит «Köln».
const normalize = (text) =>
  (text ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

// Выбор города: поиск по названию (и по стране), фильтр по стране и список городов. Общий для
// регистрации, настроек и модератора. cities — [{ slug, name, country }] или null (грузятся);
// value — slug выбранного; onChange(slug). Enter в поиске выбирает первый найденный город и не
// отправляет форму вокруг.
export function CityPicker({ cities, value, onChange, label, autoFocus = false, error }) {
  const texts = common.cityPicker;
  const name = useId();
  const [query, setQuery] = useState('');
  const [country, setCountry] = useState('');

  const countries = useMemo(() => {
    const present = new Set((cities ?? []).map((city) => city.country));
    return COUNTRIES.filter(({ code }) => present.has(code));
  }, [cities]);

  const order = (city) => COUNTRIES.findIndex(({ code }) => code === city.country);
  const needle = normalize(query);
  const found = (cities ?? [])
    .filter(
      (city) =>
        (!country || city.country === country) &&
        (!needle ||
          normalize(city.name).includes(needle) ||
          city.slug.includes(needle) ||
          normalize(COUNTRY_BY_CODE[city.country]?.label).includes(needle)),
    )
    .sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name));

  const handleKey = (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (found.length) onChange(found[0].slug);
  };

  return (
    <div className={styles.picker} data-ui="city-picker">
      <label className={styles.search}>
        <Icon name="search" size={16} />
        <input
          type="search"
          className={styles.searchInput}
          value={query}
          placeholder={texts.search}
          aria-label={texts.searchLabel}
          autoComplete="off"
          // Поиск в открывшейся панели модератора: сразу печатать название
          autoFocus={autoFocus}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKey}
        />
      </label>

      {countries.length > 1 && (
        <ChipGroup
          label={texts.countriesLabel}
          value={country}
          onChange={setCountry}
          optionDataUi="city-picker-country"
          options={[
            { code: '', label: texts.allCountries },
            ...countries.map(({ code, label: countryName }) => ({
              code,
              label: (
                <span className={styles.chipLabel}>
                  <CountryFlag code={code} />
                  {countryName}
                </span>
              ),
            })),
          ]}
        />
      )}

      <div
        className={styles.list}
        role="radiogroup"
        aria-label={label ?? texts.label}
        data-ui="city-picker-list"
      >
        {!cities && <p className={styles.note}>{texts.loading}</p>}
        {cities && !found.length && (
          <p className={styles.note}>{format(texts.empty, { query: query.trim() })}</p>
        )}
        {found.map((city) => (
          <label key={city.slug} className={styles.option}>
            <input
              type="radio"
              name={name}
              className="visually-hidden"
              checked={value === city.slug}
              onChange={() => onChange(city.slug)}
            />
            <CountryFlag code={city.country} />
            <span className={styles.optionText}>
              <span className={styles.cityName}>{city.name}</span>
              <span className={styles.country}>{COUNTRY_BY_CODE[city.country]?.label}</span>
            </span>
          </label>
        ))}
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
