import { CATEGORY_BY_CODE } from '@/shared/config/problemCategories';
import { REJECTION_REASON_BY_CODE, STATUS_BY_CODE } from '@/shared/config/problemStatuses';
import { format } from '@/shared/lib/format';
import { formatRelative } from '@/shared/lib/formatDate';
import { plural } from '@/shared/lib/plural';
import texts from '@/texts/ru/notifications.json';
import styles from './NotificationList.module.css';

const ICONS = {
  confirmations: (
    <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 19c0-3 2.7-5 6-5s6 2 6 5M15.5 11l1.8 1.8L21 9" />
  ),
  confirmed: (
    <path d="M12 21s-6.5-5.4-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.6 12 21 12 21zM9.5 10l2 2 3.5-3.5" />
  ),
  in_progress: (
    <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3.5 17.5l3 3 5.8-5.8a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4 2.6-2.6z" />
  ),
  resolved: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12.5l2.7 2.7L16.5 9.5" />,
  rejected: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM5.6 5.6l12.8 12.8" />,
};

function describe(item) {
  const category = CATEGORY_BY_CODE[item.problem.category].label;
  if (item.kind === 'confirmations') {
    return {
      key: 'confirmations',
      color: '--status-resolved',
      text: format(texts.kinds.confirmations, {
        category,
        count: item.count,
        people: plural(item.count, texts.people),
      }),
    };
  }
  return {
    key: item.status,
    color: STATUS_BY_CODE[item.status].colorVar,
    text: format(texts.kinds[item.status], {
      category,
      reason: REJECTION_REASON_BY_CODE[item.problem.rejection_reason]?.label.toLowerCase(),
    }),
  };
}

// Список уведомлений: новые подсвечены и отмечены точкой. Клик ведёт к проблеме на карте.
export function NotificationList({ items, onOpen }) {
  return (
    <ul className={styles.list}>
      {items
        .filter((item) => item.problem)
        .map((item, i) => {
          const { key, color, text } = describe(item);
          return (
            <li key={item.id} style={{ '--i': i }}>
              <button
                type="button"
                className={styles.item}
                data-unread={!item.read || undefined}
                style={{ '--tone': `var(${color})` }}
                onClick={() => onOpen(item)}
              >
                <span className={styles.icon}>
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                    {ICONS[key]}
                  </svg>
                </span>
                <span className={styles.body}>
                  <span className={styles.text}>{text}</span>
                  <span className={styles.meta}>
                    {format(texts.meta, {
                      district: item.problem.district_name,
                      time: formatRelative(item.created_at),
                    })}
                  </span>
                </span>
                {!item.read && (
                  <span className={styles.dot}>
                    <span className="visually-hidden">{texts.unread}</span>
                  </span>
                )}
              </button>
            </li>
          );
        })}
    </ul>
  );
}
