import { useNotifications } from '../model/useNotifications';
import { NotificationList } from './NotificationList';
import texts from '@/texts/ru/notifications.json';
import styles from './NotificationsPanel.module.css';
import { Icon } from '@/shared/ui/icons/Icon';

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
            <Icon name="bell-large" size={48} />
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
          <Icon name="chevron-right" size={12} />
        </button>
      </footer>
    </div>
  );
}
