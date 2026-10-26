import { useState } from 'react';
import { CategoryIcon, StatusChip, StatusTimeline } from '@/features/problems';
import { changeProblemStatus } from '@/shared/api/endpoints/moderation';
import { CATEGORY_BY_CODE } from '@/shared/config/problemCategories';
import {
  isStepBack,
  MODERATOR_TRANSITIONS,
  REJECTION_REASON_BY_CODE,
  STATUS_BY_CODE,
} from '@/shared/config/problemStatuses';
import { format } from '@/shared/lib/format';
import { formatRelative } from '@/shared/lib/formatDate';
import { Avatar } from '@/shared/ui/avatar/Avatar';
import { Button } from '@/shared/ui/controls/Button';
import { RejectForm } from './RejectForm';
import texts from '@/texts/ru/moderation.json';
import styles from './QueueItem.module.css';

// Одна проблема в очереди: что, где, кто, сколько подтверждений — и что модератор может сделать в её
// статусе. Подробности (полный текст, фото, история) раскрываются по кнопке; на карте модератора
// они открыты сразу (expandedByDefault), а ссылки «На карте» нет (onOpenProblem не передан).
export function QueueItem({ problem, onChanged, onOpenProblem, expandedByDefault = false }) {
  const [expanded, setExpanded] = useState(expandedByDefault);
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const next = MODERATOR_TRANSITIONS[problem.status] ?? [];

  const apply = async (status, extra = {}) => {
    setBusy(status);
    setError('');
    try {
      const updated = await changeProblemStatus(problem.id, { status, ...extra });
      setRejecting(false);
      onChanged(updated);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <li
      className={styles.item}
      style={{ '--status-color': `var(${STATUS_BY_CODE[problem.status].colorVar})` }}
    >
      <div className={styles.main} data-ui="moderation-item">
        <span className={styles.icon}>
          <CategoryIcon category={problem.category} size={22} />
        </span>
        <div className={styles.body}>
          <p className={styles.meta}>
            {format(texts.queue.number, { id: problem.id })} · {problem.district_name} ·{' '}
            {formatRelative(problem.created_at)}
          </p>
          <h3 className={styles.title}>{CATEGORY_BY_CODE[problem.category].label}</h3>
          {problem.rejection_reason && (
            <p className={styles.reason}>
              {REJECTION_REASON_BY_CODE[problem.rejection_reason].label}
            </p>
          )}
          <p className={styles.description} data-expanded={expanded || undefined}>
            {problem.description}
          </p>
          <p className={styles.author}>
            <Avatar src={problem.author.avatar_url} size={18} />
            {format(texts.queue.author, { nickname: problem.author.nickname })}
            {problem.is_anonymous && <span className={styles.tag}>{texts.queue.anonymous}</span>}
          </p>
        </div>
        <div className={styles.side} data-ui="moderation-item-side">
          <StatusChip status={problem.status} />
          <span className={styles.count}>
            {format(texts.queue.confirmations, { count: problem.confirmations_count })}
          </span>
        </div>
      </div>

      {expanded && (
        <div className={styles.details}>
          {problem.photos?.length > 0 && (
            <div className={styles.photos}>
              {problem.photos.map((photo) => (
                <img key={photo.url} src={photo.url} alt={texts.queue.photoAlt} />
              ))}
            </div>
          )}
          <StatusTimeline
            status={problem.status}
            history={problem.history}
            label={texts.queue.history}
            compact
          />
        </div>
      )}

      <div className={styles.actions} data-ui="moderation-item-actions">
        {next
          .filter((status) => status !== 'rejected')
          .map((status) => (
            <Button
              key={status}
              size="sm"
              variant={isStepBack(problem.status, status) ? 'ghost' : 'primary'}
              loading={busy === status}
              disabled={Boolean(busy)}
              onClick={() => apply(status)}
            >
              {texts.queue.stepActions[`${problem.status}_${status}`] ??
                texts.queue.actions[status]}
            </Button>
          ))}
        {next.includes('rejected') && !rejecting && (
          <Button
            variant="ghost"
            size="sm"
            disabled={Boolean(busy)}
            onClick={() => setRejecting(true)}
          >
            {texts.queue.actions.rejected}
          </Button>
        )}
        <span className={styles.spacer} />
        <Button variant="text" onClick={() => setExpanded((value) => !value)}>
          {expanded ? texts.queue.collapse : texts.queue.expand}
        </Button>
        {onOpenProblem && problem.status !== 'rejected' && (
          <Button variant="text" onClick={() => onOpenProblem(problem.id)}>
            {texts.queue.openOnMap}
          </Button>
        )}
      </div>

      {rejecting && (
        <RejectForm
          loading={busy === 'rejected'}
          onSubmit={({ reason, duplicateOf }) => apply('rejected', { reason, duplicateOf })}
          onCancel={() => setRejecting(false)}
        />
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </li>
  );
}
