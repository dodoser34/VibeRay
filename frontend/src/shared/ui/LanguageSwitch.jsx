import { changeLanguage } from '@/shared/animations/languageTransition';
import { useLanguage } from '@/shared/hooks/useLanguage';
import { LANGUAGES } from '@/shared/lib/language';
import common from '@/texts/ru/common.json';
import gbFlag from './flags/gb.svg';
import ruFlag from './flags/ru.svg';
import styles from './LanguageSwitch.module.css';

// Флаг главной страны языка: русский — Россия, английский — Великобритания (локаль en-GB).
const FLAGS = { ru: ruFlag, en: gbFlag };

// Переключатель языка интерфейса — флагами (full — флаг и название языка). Названия языков — на самих
// языках. Язык меняется без перезагрузки: текст плавно размывается и проявляется уже на новом.
export function LanguageSwitch({ full = false, className = '' }) {
  const current = useLanguage();
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
          aria-label={full ? undefined : common.language.names[code]}
          title={common.language.names[code]}
          onClick={() => changeLanguage(code)}
        >
          <span className={styles.flag} aria-hidden="true">
            <img src={FLAGS[code]} alt="" draggable="false" />
          </span>
          {full && <span data-language-static>{common.language.names[code]}</span>}
        </button>
      ))}
    </div>
  );
}
