import deFlag from '../flags/de.svg';
import gbFlag from '../flags/gb.svg';
import kzFlag from '../flags/kz.svg';
import ruFlag from '../flags/ru.svg';
import styles from './CountryFlag.module.css';

const FLAGS = { KZ: kzFlag, RU: ruFlag, DE: deFlag, GB: gbFlag };

// Флаг страны города (код ISO из GET /cities). Декоративный: название страны всегда рядом текстом.
export function CountryFlag({ code }) {
  if (!FLAGS[code]) return null;
  return <img className={styles.flag} src={FLAGS[code]} alt="" width="20" height="14" />;
}
