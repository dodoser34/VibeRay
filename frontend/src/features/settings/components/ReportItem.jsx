import { useState } from 'react';
import { useHref } from 'react-router';
import { CategoryIcon, StatusTimeline } from '@/features/problems';
import { CATEGORY_BY_CODE } from '@/shared/config/problemCategories';
import { withdrawProblem } from '@/shared/api/endpoints/problems';
import { hideMyProblem } from '@/shared/api/endpoints/users';
import {
  REJECTION_REASON_BY_CODE,
  STATUS_BY_CODE,
  WITHDRAWABLE_STATUSES,
} from '@/shared/config/problemStatuses';
import { useShare } from '@/shared/hooks/useShare';
import { format } from '@/shared/lib/format';
import { formatDate } from '@/shared/lib/formatDate';
import { localizePath } from '@/shared/lib/language';
import { plural } from '@/shared/lib/plural';
import { ConfirmDialog } from '@/shared/ui/windows/ConfirmDialog';
import problemTexts from '@/texts/ru/problems.json';
import texts from '@/texts/ru/settings.json';
import styles from './ReportItem.module.css';
import { Icon } from '@/shared/ui/icons/Icon';

const CITY = 'kostanay';

// Одно своё сообщение: что, где, когда, путь статусов и сколько соседей подтвердили. Корзина есть у
// каждого: пока город не взялся за проблему, сообщение отзывается целиком; в работе и решённое —
// только убирается из списка, на карте остаётся (onWithdrawn — после ответа сервера).
export function ReportItem({ problem, districtName, index, onOpen, onWithdrawn }) {
  const [confirming, setConfirming] = useState(false);
  const path = `/map/${CITY}/problem/${problem.id}`;
  const href = useHref(localizePath(path));
  const { state: shareState, share } = useShare();
  const category = CATEGORY_BY_CODE[problem.category].label;
  const count = problem.confirmations_count;
  const withdrawable = WITHDRAWABLE_STATUSES.includes(problem.status);
  const removal = withdrawable ? problemTexts.withdraw : problemTexts.hide;

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
            <Icon name="place" size={14} />
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
            <Icon name="link" size={14} />
          </button>
          <button
            type="button"
            className={styles.iconButton}
            data-tone="danger"
            aria-label={removal.action}
            title={removal.action}
            onClick={() => setConfirming(true)}
          >
            <Icon name="trash" size={14} />
          </button>
          {shareState === 'copied' && (
            <span className={styles.copied} role="status">
              {texts.reports.copied}
            </span>
          )}
        </div>
      </div>

      {confirming && (
        <ConfirmDialog
          title={removal.title}
          text={removal.text}
          confirmLabel={removal.confirm}
          cancelLabel={removal.cancel}
          onConfirm={async () => {
            await (withdrawable ? withdrawProblem(problem.id) : hideMyProblem(problem.id));
            setConfirming(false);
            onWithdrawn();
          }}
          onClose={() => setConfirming(false)}
        />
      )}
    </li>
  );
}
