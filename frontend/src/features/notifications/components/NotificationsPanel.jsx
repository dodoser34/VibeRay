import { useNotifications } from '../model/useNotifications';
import emptyFigure from '../assets/empty-tea.webp';
import { NotificationList } from './NotificationList';
import texts from '@/texts/ru/notifications.json';
import styles from './NotificationsPanel.module.css';
import { Icon } from '@/shared/ui/icons/Icon';

const CITY = 'kostanay';

// Содержимое уведомлений — одно и то же в выпадающей панели колокольчика и в шторке телефона.
// onNavigate(path) уводит на страницу (с переходом); onDone закрывает панель.
// compact: заголовок уже даёт окно-шторка, остаются только «Прочитать все» и «Очистить».
export function NotificationsPanel({ onNavigate, onDone, headingId, compact = false }) {
  const { items, unread, loaded, markRead, remove } = useNotifications();

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
        {items.length > 0 && (
          <div className={styles.headerActions}>
            {unread > 0 && (
              <button type="button" className={styles.readAll} onClick={() => markRead()}>
                {texts.readAll}
              </button>
            )}
            <button type="button" className={styles.readAll} onClick={() => remove()}>
              {texts.clearAll}
            </button>
          </div>
        )}
      </header>

      <div className={styles.scroll}>
        {!loaded ? (
          <p className={styles.state}>{texts.loading}</p>
        ) : items.length === 0 ? (
          <div className={styles.empty}>
            <img
              className={styles.emptyArt}
              src={emptyFigure}
              width="480"
              height="480"
              alt=""
              draggable="false"
              decoding="async"
            />
            <p className={styles.emptyTitle}>{texts.emptyTitle}</p>
            <p className={styles.state}>{texts.empty}</p>
          </div>
        ) : (
          <NotificationList items={items} onOpen={open} onRemove={(item) => remove([item.id])} />
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
