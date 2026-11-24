import { useState } from 'react';
import { COUNTRY_BY_CODE } from '@/shared/config/countries';
import { useCities } from '@/shared/hooks/useCities';
import { format } from '@/shared/lib/i18n/format';
import { formatNumber } from '@/shared/lib/i18n/formatNumber';
import { plural } from '@/shared/lib/i18n/plural';
import { CityPicker } from '@/shared/ui/cityPicker/CityPicker';
import { CountryFlag } from '@/shared/ui/cityPicker/CountryFlag';
import { Button } from '@/shared/ui/controls/Button';
import texts from '@/texts/en/moderation.json';
import styles from './ModerationCityBar.module.css';

// Город модератора: какой город сейчас открыт (страна, число районов) и кнопка «Сменить город» —
// она раскрывает поиск по всем городам с выбором страны. Выбор сразу закрывает панель.
// city — slug текущего; districtCount — районов в нём (null, пока город грузится); onChange(slug).
// compact — узкая панель карты модератора: всё в одну колонку.
export function ModerationCityBar({ city, districtCount = null, onChange, compact = false }) {
  const cities = useCities();
  const [open, setOpen] = useState(false);
  const current = cities?.find((item) => item.slug === city);
  const country = COUNTRY_BY_CODE[current?.country]?.label;
  const meta = [
    country,
    districtCount !== null &&
      format(texts.cityPicker.districts, {
        count: formatNumber(districtCount),
        forms: plural(districtCount, texts.cityPicker.districtForms),
      }),
  ]
    .filter(Boolean)
    .join(' · ');

  const choose = (slug) => {
    onChange(slug);
    setOpen(false);
  };

  return (
    <section
      className={styles.bar}
      data-compact={compact || undefined}
      aria-label={texts.cityPicker.label}
      data-ui="moderation-city-bar"
    >
      <div className={styles.current}>
        <CountryFlag code={current?.country} />
        <div className={styles.text}>
          <span className={styles.label}>{texts.cityPicker.label}</span>
          <strong className={styles.name}>{current?.name ?? '…'}</strong>
          {meta && <span className={styles.meta}>{meta}</span>}
        </div>
        <Button
          variant={open ? 'primary' : 'ghost'}
          size="sm"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? texts.cityPicker.done : texts.cityPicker.change}
        </Button>
      </div>
      {open && <CityPicker cities={cities} value={city} onChange={choose} autoFocus />}
    </section>
  );
}
