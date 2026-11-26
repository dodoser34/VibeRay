import styles from './DashboardBlock.module.css';

// Блок дашборда: заголовок и содержимое (график, таблица, разбивка).
export function DashboardBlock({ title, children }) {
  return (
    <section className={styles.block}>
      <h3 className={styles.blockTitle}>{title}</h3>
      {children}
    </section>
  );
}
