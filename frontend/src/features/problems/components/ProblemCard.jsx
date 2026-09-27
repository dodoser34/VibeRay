import { useState } from 'react';
import { confirmProblem } from '@/shared/api/endpoints/problems';
import { CATEGORY_BY_CODE } from '@/shared/config/problemCategories';
import { PROBLEM_STATUSES } from '@/shared/config/problemStatuses';
import { formatDate } from '@/shared/lib/formatDate';
import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { StatusChip } from './StatusChip';
import problemTexts from '@/texts/problems.json';
import styles from './ProblemCard.module.css';

const texts = problemTexts.card;

export function ProblemCard({ problem, districtName, isGuest, onRequireAuth, onUpdated, onClose }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const currentStep = PROBLEM_STATUSES.findIndex((s) => s.code === problem.status);

  const handleConfirm = async () => {
    if (isGuest) return onRequireAuth();
    setLoading(true);
    setMessage('');
    try {
      onUpdated(await confirmProblem(problem.id));
      setMessage(texts.confirmed);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <article className={styles.root} aria-label={texts.label} data-ui="map-detail">
      <header className={styles.header} data-sheet-drag>
        <div>
          <p className={styles.kicker}>{districtName}</p>
          <h3 className={styles.title}>{CATEGORY_BY_CODE[problem.category].label}</h3>
        </div>
        <button
          type="button"
          className={styles.close}
          data-ui="panel-close"
          onClick={onClose}
          aria-label={texts.close}
        >
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
            <path d="M3 3l10 10M13 3L3 13" />
          </svg>
        </button>
      </header>

      <StatusChip status={problem.status} />
      <p className={styles.description}>{problem.description}</p>

      {problem.photos?.length > 0 && (
        <div className={styles.photos}>
          {problem.photos.map((photo) => (
            <a
              key={photo.url}
              href={photo.url}
              target="_blank"
              rel="noreferrer"
              className={styles.photo}
            >
              <img src={photo.url} alt={texts.photoAlt} loading="lazy" />
            </a>
          ))}
        </div>
      )}

      <ol className={styles.timeline} aria-label={texts.statusLabel}>
        {PROBLEM_STATUSES.map((status, i) => (
          <li key={status.code} data-done={i <= currentStep}>
            {status.label}
          </li>
        ))}
      </ol>

      <footer className={styles.footer}>
        <span className={styles.author}>
          <Avatar src={problem.author.avatar_url} size={24} />
          {problem.author.nickname} · {formatDate(problem.created_at)}
        </span>
        <span className={styles.count}>✓ {problem.confirmations_count}</span>
      </footer>

      <Button variant="ghost" block loading={loading} onClick={handleConfirm}>
        {texts.confirm}
      </Button>
      {message && (
        <p className={styles.message} role="status">
          {message}
        </p>
      )}
    </article>
  );
}
