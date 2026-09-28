import { getLanguage, LANGUAGES, setLanguage } from '@/shared/lib/language';
import common from '@/texts/ru/common.json';
import styles from './LanguageSwitch.module.css';

// Переключатель языка интерфейса: RU / EN (full — полные названия). Названия языков — на самих языках.
// Выбор сохраняется, страница перезагружается на том же адресе.
export function LanguageSwitch({ full = false, className = '' }) {
  const current = getLanguage();
  return (
    <div
      className={`${styles.root} ${className}`}
      role="group"
      aria-label={common.language.label}
      data-full={full || undefined}
      data-ui="language-switch"
    >
      {LANGUAGES.map((code) => (
        <button
          key={code}
          type="button"
          lang={code}
          className={styles.option}
          aria-pressed={code === current}
          title={common.language.names[code]}
          onClick={() => setLanguage(code)}
        >
          {full ? common.language.names[code] : common.language.short[code]}
        </button>
      ))}
    </div>
  );
}
