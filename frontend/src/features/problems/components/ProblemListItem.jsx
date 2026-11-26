import { CATEGORY_BY_CODE } from '@/shared/config/problemCategories';
import { formatRelative } from '@/shared/lib/i18n/formatDate';
import { format } from '@/shared/lib/i18n/format';
import texts from '@/texts/en/problems.json';
import { StatusChip } from './StatusChip';
import styles from './ProblemListItem.module.css';

export function ProblemListItem({ problem, onSelect }) {
  return (
    <button type="button" className={styles.root} onClick={() => onSelect(problem)}>
      <span className={styles.top}>
        <span className={styles.category}>{CATEGORY_BY_CODE[problem.category].label}</span>
        <StatusChip status={problem.status} />
      </span>
      <span className={styles.description}>{problem.description}</span>
      <span className={styles.meta}>
        {formatRelative(problem.created_at)} ·{' '}
        {format(texts.listItem.confirmations, { count: problem.confirmations_count })}
      </span>
    </button>
  );
}
