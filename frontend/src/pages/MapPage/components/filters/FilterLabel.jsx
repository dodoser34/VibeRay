import styles from './FilterLabel.module.css';

// Подпись группы фильтров (заглавными, мелко): у FilterGroup и у ползунка высоты, где подпись стоит
// внутри <label> вместе со значением.
export function FilterLabel({ children }) {
  return <span className={styles.label}>{children}</span>;
}
