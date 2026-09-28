import { useNotifications } from '../model/useNotifications';
import { NotificationList } from './NotificationList';
import texts from '@/texts/ru/notifications.json';
import styles from './NotificationsPanel.module.css';

const CITY = 'kostanay';

// Содержимое уведомлений — одно и то же в выпадающей панели колокольчика и в шторке телефона.
// onNavigate(path) уводит на страницу (с переходом); onDone закрывает панель.
// compact: заголовок уже даёт окно-шторка, остаётся только «Прочитать все».
export function NotificationsPanel({ onNavigate, onDone, headingId, compact = false }) {
  const { items, unread, loaded, markRead } = useNotifications();

  const open = (item) => {
    if (!item.read) markRead([item.id]);
    onDone();
    onNavigate(`/map/${CITY}/problem/${item.problem_id}`);
  };

  return (
    <div className={styles.panel}>
      <header className={styles.header} data-compact={compact || undefined}>
        {!compact && (
          <h2 id={headingId} className={styles.title}>
            {texts.title}
          </h2>
        )}
        {unread > 0 && (
          <button type="button" className={styles.readAll} onClick={() => markRead()}>
            {texts.readAll}
          </button>
        )}
      </header>

      <div className={styles.scroll}>
        {!loaded ? (
          <p className={styles.state}>{texts.loading}</p>
        ) : items.length === 0 ? (
          <div className={styles.empty}>
            <svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
              <path d="M24 40a4 4 0 0 0 4-4h-8a4 4 0 0 0 4 4zM12 32h24l-3-4v-8a9 9 0 0 0-18 0v8z" />
            </svg>
            <p className={styles.emptyTitle}>{texts.emptyTitle}</p>
            <p className={styles.state}>{texts.empty}</p>
          </div>
        ) : (
          <NotificationList items={items} onOpen={open} />
        )}
      </div>

      <footer className={styles.footer}>
        <button
          type="button"
          className={styles.more}
          onClick={() => {
            onDone();
            onNavigate('/settings#settings-reports');
          }}
        >
          {texts.allReports}
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
            <path d="M6 3l5 5-5 5" />
          </svg>
        </button>
      </footer>
    </div>
  );
}
