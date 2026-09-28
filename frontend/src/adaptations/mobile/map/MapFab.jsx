import { useState } from 'react';
import { Modal } from '@/shared/ui/Modal';
import texts from '@/texts/ru/map.json';
import styles from './MapFab.module.css';

// Плавающие кнопки над картой на телефонах и планшетах стоя, прямо над шторкой: «весь город» (после
// щипков и поворотов город легко потерять) и главная «+», которая открывает действия — отметить
// настроение, сообщить о проблеме — крупными строками в шторке вместо нескольких кнопок поверх
// карты.
// actions: [{ key, label, hint, icon, primary, onSelect }]
export function MapFab({ actions, onRecenter, hidden = false }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className={styles.stack} data-panel="float" data-hidden={hidden || undefined}>
        <button
          type="button"
          className={styles.round}
          aria-label={texts.fab.recenter}
          onClick={onRecenter}
        >
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            aria-hidden="true"
            className={styles.icon}
          >
            <path d="M12 3v3M12 18v3M3 12h3M18 12h3M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
          </svg>
        </button>
        {actions.length > 0 && (
          <button
            type="button"
            className={styles.main}
            data-onboarding="actions"
            aria-label={texts.fab.open}
            aria-haspopup="dialog"
            onClick={() => setOpen(true)}
          >
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              aria-hidden="true"
              className={styles.icon}
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        )}
      </div>
      {open && (
        <Modal title={texts.fab.title} onClose={() => setOpen(false)}>
          <ul className={styles.actions}>
            {actions.map((action) => (
              <li key={action.key}>
                <button
                  type="button"
                  className={styles.action}
                  data-primary={action.primary || undefined}
                  onClick={() => {
                    setOpen(false);
                    action.onSelect();
                  }}
                >
                  <span className={styles.actionIcon} aria-hidden="true">
                    {action.icon}
                  </span>
                  <span className={styles.actionText}>
                    <span className={styles.actionLabel}>{action.label}</span>
                    {action.hint && <span className={styles.actionHint}>{action.hint}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </>
  );
}
