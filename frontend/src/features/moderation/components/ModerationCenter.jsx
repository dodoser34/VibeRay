import { useRef, useState } from 'react';
import { gsap, SplitText, useGSAP } from '@/shared/animations/gsapSetup';
import { getModerationSummary } from '@/shared/api/endpoints/moderation';
import { useLanguage } from '@/shared/hooks/useLanguage';
import { usePageEntered } from '@/shared/hooks/usePageEntered';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { useRequest } from '@/shared/hooks/useRequest';
import { formatNumber } from '@/shared/lib/formatNumber';
import { CityOverview } from './CityOverview';
import { ProblemQueue } from './ProblemQueue';
import { SupportInbox } from './SupportInbox';
import texts from '@/texts/ru/moderation.json';
import styles from './ModerationCenter.module.css';

const DEFAULT_FILTERS = { status: 'active', district: '', category: '', sort: 'newest' };

// Разделы рабочего места модератора со сводкой сверху: section — queue (очередь проблем: смена
// статусов и отклонение), city (где копятся проблемы) или support (обращения жителей). Плотнее,
// чем страницы жителей: модератор работает со списками.
// districts: [{ slug, name }] или null, пока город грузится; district — район, с которым открыта
// очередь (из раздела «Город»); onOpenProblem(id) — проблема на карте модератора;
// onOpenDistrict(slug) — очередь района.
export function ModerationCenter({
  section,
  districts,
  district = '',
  onOpenProblem,
  onOpenDistrict,
}) {
  const language = useLanguage();
  const rootRef = useRef(null);
  const reduced = useReducedMotion();
  const entered = usePageEntered();
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS, district });
  const summary = useRequest('moderation:summary', getModerationSummary);
  const data = summary.data;

  useGSAP(
    () => {
      if (reduced || !entered) return;
      const split = SplitText.create('[data-title]', { type: 'words', mask: 'words' });
      gsap
        .timeline({ defaults: { ease: 'power3.out' } })
        .from(split.words, { yPercent: 110, duration: 0.9, stagger: 0.08 }, 0.1)
        .from('[data-hero]', { y: 16, autoAlpha: 0, duration: 0.6, stagger: 0.06 }, 0.3);
    },
    { scope: rootRef, dependencies: [reduced, entered, section], revertOnUpdate: true },
  );

  const number = (value) =>
    value === null || value === undefined ? texts.kpi.noData : formatNumber(value);
  const kpis = data && [
    { key: 'waiting', value: data.counts.new + data.counts.confirmed, tone: 'new' },
    { key: 'stale', value: data.stale_confirmed, tone: data.stale_confirmed ? 'alert' : undefined },
    { key: 'inProgress', value: data.counts.in_progress, tone: 'progress' },
    { key: 'resolvedWeek', value: data.resolved_week, tone: 'resolved' },
    { key: 'avgResolution', value: data.avg_resolution_days },
    { key: 'supportNew', value: data.support_new, tone: data.support_new ? 'alert' : undefined },
  ];

  return (
    <div ref={rootRef} className={styles.center} data-ui="moderation-page">
      <header className={styles.hero}>
        <p className={styles.kicker} data-hero>
          {texts.kicker}
        </p>
        <h1 key={`${language}-${section}`} className={styles.title} data-title>
          {texts.sections[section]}
        </h1>
        <p className={styles.lead} data-hero>
          {texts.leads[section]}
        </p>
      </header>

      <dl className={styles.kpis} aria-label={texts.kpiLabel} data-ui="moderation-kpis" data-hero>
        {(kpis ?? []).map((kpi) => (
          <div key={kpi.key} className={styles.kpi} data-tone={kpi.tone}>
            <dt>{texts.kpi[kpi.key]}</dt>
            <dd>{number(kpi.value)}</dd>
          </div>
        ))}
      </dl>

      {section === 'queue' && (
        <ProblemQueue
          districts={districts}
          filters={filters}
          onFiltersChange={setFilters}
          onChanged={summary.reload}
          onOpenProblem={onOpenProblem}
        />
      )}
      {section === 'city' && <CityOverview summary={data} onOpenDistrict={onOpenDistrict} />}
      {section === 'support' && <SupportInbox onChanged={summary.reload} />}
    </div>
  );
}
