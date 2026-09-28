import { getServiceStatus } from '@/shared/api/endpoints/support';
import { SERVICE_STATE_BY_CODE } from '@/shared/config/support';
import { useRequest } from '@/shared/hooks/useRequest';
import { formatTime } from '@/shared/lib/formatDate';
import { format } from '@/shared/lib/format';
import texts from '@/texts/ru/support.json';
import styles from './ServiceStatus.module.css';

// Состояние основных сервисов из GET /status.
export function ServiceStatus() {
  const status = useRequest('service-status', getServiceStatus);
  const services = status.data?.services ?? [];
  const allGood = services.length > 0 && services.every((s) => s.state === 'operational');

  let summary = texts.status.checking;
  if (status.error) summary = texts.status.failed;
  else if (services.length) summary = allGood ? texts.status.allGood : texts.status.issues;

  return (
    <div className={styles.status}>
      <div className={styles.head}>
        <p className={styles.summary} data-state={allGood ? 'operational' : undefined}>
          <span className={styles.pulse} aria-hidden="true" />
          {summary}
        </p>
        {status.data && (
          <p className={styles.checked}>
            {format(texts.status.checkedAt, { time: formatTime(status.data.checked_at) })}
            <button type="button" className={styles.refresh} onClick={status.reload}>
              {texts.status.refresh}
            </button>
          </p>
        )}
      </div>
      <ul className={styles.list}>
        {services.map((service) => {
          const state = SERVICE_STATE_BY_CODE[service.state];
          return (
            <li
              key={service.code}
              className={styles.row}
              style={{ '--state': `var(${state.colorVar})` }}
            >
              <span className={styles.name}>{service.label}</span>
              <span className={styles.state}>
                <span className={styles.dot} aria-hidden="true" />
                {state.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
