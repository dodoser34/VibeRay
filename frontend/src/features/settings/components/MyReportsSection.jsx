import { useMemo, useState } from 'react';
import { useAuth } from '@/features/auth';
import { PeriodSwitch } from '@/features/mood';
import { getMyProblems } from '@/shared/api/endpoints/users';
import { useRequest } from '@/shared/hooks/useRequest';
import { plural } from '@/shared/lib/plural';
import { AnimatedNumber } from '@/shared/ui/charts/AnimatedNumber';
import { Button } from '@/shared/ui/controls/Button';
import { ReportItem } from './ReportItem';
import { SettingsSection } from './SettingsSection';
import texts from '@/texts/ru/settings.json';
import styles from './MyReportsSection.module.css';

const t = texts.reports;
const matches = {
  all: () => true,
  active: (problem) => !['resolved', 'rejected'].includes(problem.status),
  resolved: (problem) => problem.status === 'resolved',
  rejected: (problem) => problem.status === 'rejected',
};

// Свои сообщения о проблемах: сводка, фильтр и список со статусами. names: slug района → название.
export function MyReportsSection({ id, names, onNavigate }) {
  const { user } = useAuth();
  const reports = useRequest(`my-problems:${user.id}`, getMyProblems);
  const [filter, setFilter] = useState('all');
  const list = reports.data;

  const summary = useMemo(() => {
    if (!list) return null;
    return {
      total: list.length,
      active: list.filter(matches.active).length,
      resolved: list.filter(matches.resolved).length,
      confirmations: list.reduce((sum, problem) => sum + problem.confirmations_count, 0),
    };
  }, [list]);

  const shown = list?.filter(matches[filter]) ?? [];
  // «Отклонённые» — только если такие сообщения есть
  const filters = ['all', 'active', 'resolved', 'rejected']
    .filter((code) => code !== 'rejected' || list?.some(matches.rejected))
    .map((code) => ({ code, label: t.filters[code] }));

  return (
    <SettingsSection id={id} title={texts.sections.reports} lead={t.lead}>
      <div className={styles.body} data-ui="settings-reports">
        {!list ? (
          <div className={styles.skeleton} aria-label={t.loading} aria-busy="true">
            <span />
            <span />
          </div>
        ) : list.length === 0 ? (
          <div className={styles.empty}>
            <svg className={styles.emptyArt} viewBox="0 0 120 96" aria-hidden="true">
              <path
                className={styles.emptyMap}
                d="M10 26l30-12 40 12 30-12v56l-30 12-40-12-30 12z"
              />
              <path className={styles.emptyFold} d="M40 14v56M80 26v56" />
              <path
                className={styles.emptyPin}
                d="M60 62s-12-11-12-21a12 12 0 0 1 24 0c0 10-12 21-12 21zm0-16a5 5 0 1 0 0-10 5 5 0 0 0 0 10z"
              />
            </svg>
            <h3 className={styles.emptyTitle}>{t.emptyTitle}</h3>
            <p className={styles.emptyText}>{t.emptyText}</p>
            <Button onClick={() => onNavigate('/map/kostanay')}>{t.report}</Button>
          </div>
        ) : (
          <>
            <dl className={styles.summary}>
              <div className={styles.stat}>
                <dt>{plural(summary.total, t.summary.total)}</dt>
                <dd>
                  <AnimatedNumber value={summary.total} />
                </dd>
              </div>
              <div className={styles.stat} data-tone="active">
                <dt>{t.summary.active}</dt>
                <dd>
                  <AnimatedNumber value={summary.active} />
                </dd>
              </div>
              <div className={styles.stat} data-tone="resolved">
                <dt>{t.summary.resolved}</dt>
                <dd>
                  <AnimatedNumber value={summary.resolved} />
                </dd>
              </div>
              <div className={styles.stat}>
                <dt>{plural(summary.confirmations, t.summary.confirmations)}</dt>
                <dd>
                  <AnimatedNumber value={summary.confirmations} />
                </dd>
              </div>
            </dl>

            <div className={styles.filter}>
              <PeriodSwitch
                value={filter}
                onChange={setFilter}
                options={filters}
                label={t.filterLabel}
              />
            </div>

            {shown.length ? (
              <ul className={styles.list} aria-label={t.listLabel} key={filter}>
                {shown.map((problem, i) => (
                  <ReportItem
                    key={problem.id}
                    problem={problem}
                    districtName={names[problem.district] ?? ''}
                    index={i}
                    onOpen={onNavigate}
                  />
                ))}
              </ul>
            ) : (
              <p className={styles.emptyFilter}>{t.emptyFilter}</p>
            )}
          </>
        )}
      </div>
    </SettingsSection>
  );
}
