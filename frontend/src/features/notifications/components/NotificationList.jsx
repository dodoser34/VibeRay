import { CATEGORY_BY_CODE } from '@/shared/config/problemCategories';
import { REJECTION_REASON_BY_CODE, STATUS_BY_CODE } from '@/shared/config/problemStatuses';
import { format } from '@/shared/lib/format';
import { formatRelative } from '@/shared/lib/formatDate';
import { plural } from '@/shared/lib/plural';
import texts from '@/texts/ru/notifications.json';
import styles from './NotificationList.module.css';
import { Icon } from '@/shared/ui/Icon';

const ICONS = {
  confirmations: 'users-check',
  confirmed: 'pin-check',
  in_progress: 'wrench',
  resolved: 'check-circle',
  rejected: 'ban',
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
                  <Icon name={ICONS[key]} size={18} />
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
