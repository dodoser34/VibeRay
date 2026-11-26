import { useRef, useState } from 'react';
import { gsap, useGSAP } from '@/shared/animations/core/gsapSetup';
import { MOODS } from '@/shared/config/moods';
import { prefersReducedMotion } from '@/shared/hooks/useReducedMotion';
import { Icon } from '@/shared/ui/icons/Icon';
import { Modal } from '@/shared/ui/windows/Modal';
import texts from '@/texts/en/mood.json';
import { MoodFace } from './MoodFace';
import styles from './MoodPicker.module.css';

// Настроение для района. Район выбран заранее (открытый или свой район пользователя), и его можно
// сменить прямо здесь. Лица крупные, как кнопки приложения: при наведении лицо оживает, выбранное
// подпрыгивает, остальные отходят назад — и окно закрывается.
export function MoodPicker({ districts, initialDistrict, onPick, onClose }) {
  const rootRef = useRef(null);
  const [district, setDistrict] = useState(initialDistrict ?? null);
  const [pending, setPending] = useState(null);
  const [error, setError] = useState('');

  const { contextSafe } = useGSAP(
    () => {
      gsap.from('[data-district]', {
        y: 8,
        autoAlpha: 0,
        duration: 0.4,
        ease: 'power3.out',
        stagger: 0.015,
        delay: 0.1,
        clearProps: 'transform',
      });
      gsap.from('[data-mood]', {
        y: 18,
        scale: 0.7,
        autoAlpha: 0,
        duration: 0.6,
        ease: 'back.out(1.8)',
        stagger: 0.05,
        delay: 0.2,
        clearProps: 'transform',
      });
    },
    { scope: rootRef },
  );

  const choose = contextSafe(async (code, element) => {
    if (!district) {
      setError(texts.picker.chooseDistrictFirst);
      gsap.fromTo(
        '[data-districts]',
        { x: -6 },
        { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)', clearProps: 'transform' },
      );
      return;
    }
    setPending(code);
    setError('');
    if (!prefersReducedMotion()) {
      await gsap
        .timeline()
        .to(element, { scale: 1.08, duration: 0.18, ease: 'power2.out' })
        .to(element.querySelector('[data-face]'), { y: -10, duration: 0.18, ease: 'power2.out' }, 0)
        .to(element.querySelector('[data-face]'), { y: 0, duration: 0.35, ease: 'bounce.out' })
        .to(element, { scale: 1, duration: 0.3, ease: 'power2.out' }, '<');
    }
    try {
      await onPick(code, district);
    } catch (error) {
      setError(error.message);
      setPending(null);
    }
  });

  return (
    <Modal title={texts.picker.title} onClose={onClose} width={600}>
      <div ref={rootRef} className={styles.content}>
        <div className={styles.section}>
          <p className={styles.label}>{texts.picker.districtLabel}</p>
          <div
            className={styles.districts}
            role="radiogroup"
            aria-label={texts.picker.districtLabel}
            data-districts
          >
            {districts.map((option) => (
              <button
                key={option.slug}
                type="button"
                role="radio"
                aria-checked={district === option.slug}
                className={styles.district}
                data-district
                onClick={() => {
                  setDistrict(option.slug);
                  setError('');
                }}
                disabled={pending !== null}
              >
                <span
                  className={styles.swatch}
                  style={{ background: `var(--district-${option.palette})` }}
                  aria-hidden="true"
                />
                {option.name}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.grid} data-ui="mood-grid">
          {MOODS.map((mood) => (
            <button
              key={mood.code}
              type="button"
              data-mood
              className={styles.option}
              style={{ '--mood-color': `var(${mood.colorVar})` }}
              disabled={pending !== null}
              aria-pressed={pending === mood.code}
              onClick={(event) => choose(mood.code, event.currentTarget)}
            >
              <span className={styles.face} data-face>
                <MoodFace mood={mood.code} size={64} label="" />
              </span>
              <span>{mood.label}</span>
            </button>
          ))}
        </div>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <p className={styles.lead}>
          <Icon name="lock" size={14} className={styles.lock} />
          {texts.picker.privacy}
        </p>
      </div>
    </Modal>
  );
}
