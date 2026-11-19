import texts from '@/texts/en/map.json';
import styles from './MapAttribution.module.css';

// Требование лицензии OpenStreetMap (ODbL): подпись видна на экране любого размера.
export function MapAttribution() {
  return (
    <p className={styles.attribution} data-ui="map-attribution">
      {texts.attribution.prefix}{' '}
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
        {texts.attribution.osm}
      </a>
    </p>
  );
}
