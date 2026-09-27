import { STATUS_BY_CODE } from '@/shared/config/problemStatuses';
import styles from './StatusChip.module.css';

export function StatusChip({ status }) {
  const config = STATUS_BY_CODE[status];
  return (
    <span className={styles.root} style={{ '--status-color': `var(${config.colorVar})` }}>
      {config.label}
    </span>
  );
}
