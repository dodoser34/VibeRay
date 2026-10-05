import { useState } from 'react';
import { format } from '@/shared/lib/format';
import { Modal } from '@/shared/ui/Modal';
import texts from '@/texts/ru/map.json';
import styles from './FilterChip.module.css';
import { Icon } from '@/shared/ui/icons/Icon';

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
        <Icon name="filter" size={14} className={styles.icon} />
        <span className={styles.summary}>{summary}</span>
        <Icon name="chevron-down" size={12} className={styles.caret} />
      </button>
      {open && (
        <Modal title={texts.filters.title} onClose={() => setOpen(false)}>
          <div className={styles.filters}>{children}</div>
        </Modal>
      )}
    </>
  );
}
