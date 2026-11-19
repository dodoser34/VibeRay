import { STEPS } from '../../lib/registerSteps';
import auth from '@/texts/en/auth.json';
import styles from './RegisterProgress.module.css';

// Полоса шагов регистрации: пройденные, текущий и оставшиеся.
export function RegisterProgress({ step }) {
  return (
    <ol className={styles.steps} aria-label={auth.register.stepsLabel} data-part>
      {STEPS.map((item, i) => (
        <li
          key={item.key}
          className={styles.stepItem}
          data-state={i < step ? 'done' : i === step ? 'current' : 'todo'}
          aria-current={i === step ? 'step' : undefined}
        >
          <span className={styles.stepBar} />
          <span className={styles.stepLabel}>{item.label}</span>
        </li>
      ))}
    </ol>
  );
}
