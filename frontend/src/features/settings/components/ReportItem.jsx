import { useHref } from 'react-router';
import { CategoryIcon, StatusTimeline } from '@/features/problems';
import { CATEGORY_BY_CODE } from '@/shared/config/problemCategories';
import { REJECTION_REASON_BY_CODE, STATUS_BY_CODE } from '@/shared/config/problemStatuses';
import { useShare } from '@/shared/hooks/useShare';
import { format } from '@/shared/lib/format';
import { formatDate } from '@/shared/lib/formatDate';
import { plural } from '@/shared/lib/plural';
import texts from '@/texts/ru/settings.json';
import styles from './ReportItem.module.css';

const CITY = 'kostanay';

// Одно своё сообщение: что, где, когда, путь статусов и сколько соседей подтвердили.
export function ReportItem({ problem, districtName, index, onOpen }) {
  const path = `/map/${CITY}/problem/${problem.id}`;
  const href = useHref(path);
  const { state: shareState, share } = useShare();
  const category = CATEGORY_BY_CODE[problem.category].label;
  const count = problem.confirmations_count;

  const open = (event) => {
    event.preventDefault();
    onOpen(path);
  };

  return (
    <li
      className={styles.item}
      style={{
        '--status-color': `var(${STATUS_BY_CODE[problem.status].colorVar})`,
        '--i': index,
      }}
      data-status={problem.status}
    >
      <span className={styles.icon}>
        <CategoryIcon category={problem.category} size={22} />
      </span>

      <div className={styles.main}>
        <p className={styles.meta}>
          {districtName} ·{' '}
          <time dateTime={problem.created_at}>{formatDate(problem.created_at)}</time>
        </p>
        <h3 className={styles.title}>
          <a href={href} onClick={open} className={styles.link}>
            {category}
          </a>
        </h3>
        <p className={styles.text}>{problem.description}</p>
        {problem.rejection_reason && (
          <p className={styles.reason}>
            {format(texts.reports.rejectedReason, {
              reason: REJECTION_REASON_BY_CODE[problem.rejection_reason]?.label,
            })}
          </p>
        )}
        <div className={styles.timeline}>
          <StatusTimeline
            status={problem.status}
            history={problem.history}
            label={texts.reports.statusLabel}
            compact
          />
        </div>
      </div>

      <div className={styles.side}>
        <p className={styles.count}>
          <span className={styles.countValue}>{count}</span>
          <span className={styles.countLabel}>{plural(count, texts.reports.confirmations)}</span>
        </p>
        <div className={styles.actions}>
          <a href={href} onClick={open} className={styles.action}>
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path d="M8 14s-4.5-4.2-4.5-7.8a4.5 4.5 0 0 1 9 0C12.5 9.8 8 14 8 14zM8 8a1.7 1.7 0 1 0 0-3.4A1.7 1.7 0 0 0 8 8z" />
            </svg>
            {texts.reports.openOnMap}
          </a>
          <button
            type="button"
            className={styles.iconButton}
            aria-label={texts.reports.share}
            title={texts.reports.share}
            onClick={() =>
              share({ url: new URL(href, window.location.origin).href, title: category })
            }
          >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path d="M6.5 9.5l3-3M7 4.5l1.3-1.3a2.8 2.8 0 0 1 4 4L11 8.5M9 11.5l-1.3 1.3a2.8 2.8 0 0 1-4-4L5 7.5" />
            </svg>
          </button>
          {shareState === 'copied' && (
            <span className={styles.copied} role="status">
              {texts.reports.copied}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}
