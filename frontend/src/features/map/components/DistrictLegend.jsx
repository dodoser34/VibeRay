import styles from './DistrictLegend.module.css';

// Цвета районов на карте — заодно быстрый способ открыть район.
export function DistrictLegend({ districts, selectedSlug, onSelect }) {
  return (
    <ul className={styles.list}>
      {districts.map((district) => (
        <li key={district.slug}>
          <button
            type="button"
            className={styles.item}
            aria-current={district.slug === selectedSlug || undefined}
            onClick={() => onSelect(district.slug)}
          >
            <span
              className={styles.swatch}
              style={{ background: `var(--district-${district.palette})` }}
              aria-hidden="true"
            />
            {district.name}
          </button>
        </li>
      ))}
    </ul>
  );
}
