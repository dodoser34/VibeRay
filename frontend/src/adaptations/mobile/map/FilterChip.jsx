import { useState } from 'react';
import { format } from '@/shared/lib/format';
import { Modal } from '@/shared/ui/Modal';
import texts from '@/texts/ru/map.json';
import styles from './FilterChip.module.css';

// Фильтры карты, свёрнутые в один чип над картой («День · Настроение ▾»); полные настройки
// открываются в шторке. На телефонах чип стоит между логотипом и кнопкой меню, на планшетах стоя —
// под таб-баром.
export function FilterChip({ summary, children }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={styles.chip}
        data-panel="float"
        aria-haspopup="dialog"
        aria-label={format(texts.filters.chipLabel, { summary })}
        onClick={() => setOpen(true)}
      >
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" className={styles.icon}>
          <path d="M2 4h12M4.5 8h7M7 12h2" />
        </svg>
        <span className={styles.summary}>{summary}</span>
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" className={styles.caret}>
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      {open && (
        <Modal title={texts.filters.title} onClose={() => setOpen(false)}>
          <div className={styles.filters}>{children}</div>
        </Modal>
      )}
    </>
  );
}
