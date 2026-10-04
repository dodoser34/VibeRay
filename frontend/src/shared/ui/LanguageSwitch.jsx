import { useEffect, useRef, useState } from 'react';
import { changeLanguage } from '@/shared/animations/languageTransition';
import { useLanguage } from '@/shared/hooks/useLanguage';
import { LANGUAGES } from '@/shared/lib/language';
import common from '@/texts/ru/common.json';
import deFlag from './flags/de.png';
import gbFlag from './flags/gb.png';
import kzFlag from './flags/kz.png';
import ruFlag from './flags/ru.png';
import styles from './LanguageSwitch.module.css';

// Флаг главной страны языка: русский — Россия, казахский — Казахстан, английский — Великобритания
// (локаль en-GB), немецкий — Германия.
const FLAGS = { ru: ruFlag, kk: kzFlag, en: gbFlag, de: deFlag };

// Переключатель языка интерфейса — флагами (full — флаг и название языка). Названия языков — на самих
// языках. Язык меняется без перезагрузки: текст плавно размывается и проявляется уже на новом.
// Где места мало (шапка планшета стоя, adaptations/tablet), виден только флаг текущего языка:
// нажатие на него раскрывает остальные (data-open), выбор или нажатие мимо — сворачивает.
export function LanguageSwitch({ full = false, className = '' }) {
  const current = useLanguage();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  const choose = (code) => {
    if (code === current) {
      setOpen((value) => !value);
      return;
    }
    setOpen(false);
    changeLanguage(code);
  };

  return (
    <div
      ref={rootRef}
      className={`${styles.root} ${className}`}
      role="group"
      aria-label={common.language.label}
      data-full={full || undefined}
      data-open={open || undefined}
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
          data-ui="language-option"
          onClick={() => choose(code)}
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
