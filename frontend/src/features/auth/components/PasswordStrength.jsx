import { useRef } from 'react';
import { gsap, useGSAP } from '@/shared/animations/gsapSetup';
import { format } from '@/shared/lib/format';
import auth from '@/texts/ru/auth.json';
import styles from './PasswordStrength.module.css';
import { Icon } from '@/shared/ui/icons/Icon';

const SEGMENTS = 4;

// Проверка надёжности пароля на лету: шкала силы + список правил.
export function PasswordStrength({ result }) {
  const rootRef = useRef(null);

  useGSAP(
    () => {
      gsap.from('[data-check]', { x: -10, autoAlpha: 0, duration: 0.4, stagger: 0.04 });
    },
    { scope: rootRef },
  );

  return (
    <div
      ref={rootRef}
      className={styles.root}
      style={{ '--level-color': `var(${result.colorVar})` }}
      aria-live="polite"
    >
      <div className={styles.head}>
        <div className={styles.meter} aria-hidden="true">
          {Array.from({ length: SEGMENTS }, (_, i) => (
            <span key={i} data-on={i <= result.level} />
          ))}
        </div>
        <span className={styles.level}>
          {format(auth.passwordStrength.title, { level: result.label.toLowerCase() })}
        </span>
      </div>
      <ul className={styles.checks} data-ui="password-checks">
        {result.checks.map((check) => (
          <li key={check.id} data-check data-ok={check.ok} data-required={check.required}>
            <Icon name={check.ok ? 'check' : 'close'} size={12} />
            {check.label}
            <span className="visually-hidden">
              {check.ok ? auth.passwordStrength.done : auth.passwordStrength.notDone}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
