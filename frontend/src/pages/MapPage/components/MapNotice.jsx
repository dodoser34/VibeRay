import styles from './MapNotice.module.css';

// Простая панель карты: надзаголовок и заголовок (за них тянут шторку), содержимое, пояснение мелким
// шрифтом и действие. Так выглядят обзор города и «проблема не найдена».
export function MapNotice({ dataUi, kicker, title, note, action, children }) {
  return (
    <div className={styles.root} data-ui={dataUi}>
      <div data-sheet-drag>
        <p className={styles.kicker}>{kicker}</p>
        <h2 className={styles.title}>{title}</h2>
      </div>
      {children}
      <p className={styles.note}>{note}</p>
      {action}
    </div>
  );
}
