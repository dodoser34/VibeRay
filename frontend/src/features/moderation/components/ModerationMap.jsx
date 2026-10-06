import { useEffect, useRef, useState } from 'react';
import { MapCanvas } from '@/features/map';
import { getModerationQueue } from '@/shared/api/endpoints/moderation';
import { PROBLEM_STATUSES } from '@/shared/config/problemStatuses';
import { useRequest } from '@/shared/hooks/useRequest';
import { format } from '@/shared/lib/format';
import { formatNumber } from '@/shared/lib/formatNumber';
import { Icon } from '@/shared/ui/icons/Icon';
import { QueueItem } from './QueueItem';
import texts from '@/texts/ru/moderation.json';
import styles from './ModerationMap.module.css';

// Та же 3D-карта города, что у жителей, но с функциями модератора: на ней проблемы любого статуса
// (кроме отклонённых), фильтр по статусу, а по клику на метку — панель с действиями модератора.
// city, moods — данные города (страница грузит их сама); problemId — проблема, открытая по ссылке
// из очереди; onReady — карта получила данные (переход между страницами ждёт этого).
export function ModerationMap({ city, moods, problemId = null, onReady }) {
  const mapRef = useRef(null);
  const [status, setStatus] = useState('active');
  const [selectedId, setSelectedId] = useState(problemId);
  const queue = useRequest(`moderation:map:${status}`, () => getModerationQueue({ status }));
  const items = queue.data?.items ?? null;
  const selected = items?.find((p) => p.id === selectedId) ?? null;
  const statuses = [
    { code: 'active', label: texts.queue.statusActive },
    ...PROBLEM_STATUSES.map(({ code, label }) => ({ code, label })),
  ];

  useEffect(() => {
    if (items) onReady?.();
  }, [items, onReady]);

  // Проблема из очереди: камера подлетает к ней, когда метки уже на карте.
  const focusedRef = useRef(false);
  useEffect(() => {
    if (focusedRef.current || !selected || !city) return;
    focusedRef.current = true;
    mapRef.current?.focusProblem(selected);
  }, [selected, city]);

  const handleChanged = () => queue.reload();

  return (
    <div className={styles.page} data-ui="moderation-map">
      <MapCanvas
        ref={mapRef}
        city={city}
        moods={moods}
        problems={items}
        layer="problems"
        selectedProblemId={selectedId}
        onSelectProblem={(problem) => setSelectedId(problem?.id ?? null)}
      />

      <aside className={`${styles.panel} ${styles.left}`} data-ui="moderation-map-filters">
        <h1 className={styles.title} data-ui="moderation-map-title">
          {texts.map.title}
        </h1>
        <div className={styles.statuses} role="group" aria-label={texts.map.statusLabel}>
          {statuses.map(({ code, label }) => (
            <button
              key={code}
              type="button"
              className={styles.status}
              aria-pressed={status === code}
              onClick={() => setStatus(code)}
            >
              {label}
            </button>
          ))}
        </div>
        <p className={styles.count}>
          {items
            ? format(texts.map.count, { count: formatNumber(queue.data.total) })
            : texts.map.loading}
        </p>
        <ul className={styles.legend} aria-hidden="true" data-ui="moderation-map-extra">
          {PROBLEM_STATUSES.map(({ code, label, colorVar }) => (
            <li key={code}>
              <span className={styles.dot} style={{ '--dot': `var(${colorVar})` }} />
              {label}
            </li>
          ))}
        </ul>
        <p className={styles.hint} data-ui="moderation-map-extra">
          {texts.map.hint}
        </p>
      </aside>

      {selected && (
        <aside className={`${styles.panel} ${styles.right}`} data-ui="moderation-map-detail">
          <button
            type="button"
            className={styles.close}
            aria-label={texts.map.close}
            onClick={() => setSelectedId(null)}
          >
            <Icon name="close" size={14} />
          </button>
          <ul className={styles.single}>
            <QueueItem problem={selected} onChanged={handleChanged} expandedByDefault />
          </ul>
        </aside>
      )}
    </div>
  );
}
