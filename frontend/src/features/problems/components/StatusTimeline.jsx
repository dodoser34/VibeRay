import { PROBLEM_STATUSES } from '@/shared/config/problemStatuses';
import { formatDate } from '@/shared/lib/formatDate';
import { useRevealed } from '@/shared/hooks/useRevealed';
import styles from './StatusTimeline.module.css';

// Путь проблемы «новая → подтверждена → в работе → решена»: пройденные шаги цветом своего статуса,
// с датой перехода (history), текущий — с тихим кольцом. Полоса дорастает до текущего шага.
export function StatusTimeline({ status, history = [], label, compact = false }) {
  const revealed = useRevealed();
  const current = PROBLEM_STATUSES.findIndex((s) => s.code === status);
  const dateOf = (code) => history.find((step) => step.status === code)?.changed_at;

  return (
    <div className={styles.frame}>
      <ol
        className={styles.timeline}
        aria-label={label}
        data-compact={compact || undefined}
        style={{ '--progress': revealed ? current / (PROBLEM_STATUSES.length - 1) : 0 }}
      >
        {PROBLEM_STATUSES.map((step, i) => {
          const date = i <= current ? dateOf(step.code) : null;
          return (
            <li
              key={step.code}
              className={styles.step}
              data-state={i < current ? 'done' : i === current ? 'current' : 'todo'}
              aria-current={i === current ? 'step' : undefined}
              style={{ '--step-color': `var(${step.colorVar})` }}
            >
              <span className={styles.dot} aria-hidden="true" />
              <span className={styles.label}>{step.label}</span>
              {!compact && date && (
                <time className={styles.date} dateTime={date}>
                  {formatDate(date)}
                </time>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
