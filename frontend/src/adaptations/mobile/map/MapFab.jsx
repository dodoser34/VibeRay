import { useState } from 'react';
import { Modal } from '@/shared/ui/Modal';
import texts from '@/texts/ru/map.json';
import styles from './MapFab.module.css';
import { Icon } from '@/shared/ui/icons/Icon';

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
          <Icon name="recenter" size={20} className={styles.icon} />
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
            <Icon name="plus" size={24} className={styles.icon} />
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
