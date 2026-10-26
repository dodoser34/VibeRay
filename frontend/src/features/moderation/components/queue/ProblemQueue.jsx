import { useState } from 'react';
import { getModerationQueue } from '@/shared/api/endpoints/moderation';
import { PROBLEM_CATEGORIES } from '@/shared/config/problemCategories';
import { PROBLEM_STATUSES, REJECTED_STATUS } from '@/shared/config/problemStatuses';
import { useRequest } from '@/shared/hooks/useRequest';
import { format } from '@/shared/lib/format';
import { formatNumber } from '@/shared/lib/formatNumber';
import { QueueItem } from './QueueItem';
import texts from '@/texts/ru/moderation.json';
import styles from './ProblemQueue.module.css';

const SORTS = ['newest', 'oldest', 'confirmations'];

// Очередь проблем с фильтрами по статусу, району и категории. После решения модератора очередь и
// сводка перезапрашиваются, а под фильтрами коротко сказано, что произошло.
export function ProblemQueue({ districts, filters, onFiltersChange, onChanged, onOpenProblem }) {
  const [notice, setNotice] = useState('');
  const key = `moderation:queue:${filters.status}:${filters.district}:${filters.category}:${filters.sort}`;
  const queue = useRequest(key, () =>
    getModerationQueue({
      status: filters.status,
      district: filters.district || undefined,
      category: filters.category || undefined,
      sort: filters.sort,
    }),
  );
  const set = (name) => (event) => onFiltersChange({ ...filters, [name]: event.target.value });
  const statuses = [
    { code: 'active', label: texts.queue.statusActive },
    ...[...PROBLEM_STATUSES, REJECTED_STATUS].map(({ code, label }) => ({ code, label })),
  ];

  const handleChanged = (problem) => {
    setNotice(format(texts.queue.done[problem.status], { id: problem.id }));
    queue.reload();
    onChanged();
  };

  return (
    <section className={styles.queue} aria-label={texts.sections.queue}>
      <div className={styles.filters} role="group" aria-label={texts.queue.filtersLabel}>
        <div className={styles.statuses} role="group" aria-label={texts.queue.statusLabel}>
          {statuses.map(({ code, label }) => (
            <button
              key={code}
              type="button"
              className={styles.status}
              aria-pressed={filters.status === code}
              onClick={() => onFiltersChange({ ...filters, status: code })}
            >
              {label}
            </button>
          ))}
        </div>
        <div className={styles.selects} data-ui="moderation-selects">
          <label className={styles.field}>
            <span>{texts.queue.district}</span>
            <select value={filters.district} onChange={set('district')}>
              <option value="">{texts.queue.allDistricts}</option>
              {(districts ?? []).map(({ slug, name }) => (
                <option key={slug} value={slug}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>{texts.queue.category}</span>
            <select value={filters.category} onChange={set('category')}>
              <option value="">{texts.queue.allCategories}</option>
              {PROBLEM_CATEGORIES.map(({ code, label }) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>{texts.queue.sort}</span>
            <select value={filters.sort} onChange={set('sort')}>
              {SORTS.map((code) => (
                <option key={code} value={code}>
                  {texts.queue.sorts[code]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <p className={styles.notice} role="status">
        {notice}
      </p>

      {queue.data && (
        <p className={styles.count}>
          {format(texts.queue.shown, {
            shown: formatNumber(queue.data.items.length),
            total: formatNumber(queue.data.total),
          })}
        </p>
      )}

      {!queue.data && <p className={styles.empty}>{texts.queue.loading}</p>}
      {queue.data?.items.length === 0 && <p className={styles.empty}>{texts.queue.empty}</p>}
      {queue.data?.items.length > 0 && (
        <ul className={styles.list} data-loading={queue.loading || undefined}>
          {queue.data.items.map((problem) => (
            <QueueItem
              key={problem.id}
              problem={problem}
              onChanged={handleChanged}
              onOpenProblem={onOpenProblem}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
