import { useRef, useState } from 'react';
import { gsap, useGSAP } from '@/shared/animations/gsapSetup';
import { MOODS } from '@/shared/config/moods';
import { Modal } from '@/shared/ui/Modal';
import { MoodFace } from './MoodFace';
import texts from '@/texts/ru/mood.json';
import styles from './MoodPicker.module.css';

// Настроение для района. Район выбран заранее (открытый или свой район пользователя), и его можно
// сменить прямо здесь.
export function MoodPicker({ districts, initialDistrict, onPick, onClose }) {
  const gridRef = useRef(null);
  const [district, setDistrict] = useState(initialDistrict ?? null);
  const [pending, setPending] = useState(null);
  const [error, setError] = useState('');

  useGSAP(
    () => {
      gsap.from('[data-mood]', {
        scale: 0.4,
        autoAlpha: 0,
        duration: 0.6,
        ease: 'back.out(2)',
        stagger: 0.05,
        delay: 0.15,
      });
    },
    { scope: gridRef },
  );

  const choose = async (code, element) => {
    if (!district) {
      setError(texts.picker.chooseDistrictFirst);
      return;
    }
    setPending(code);
    setError('');
    gsap.fromTo(element, { scale: 1 }, { scale: 1.18, duration: 0.2, yoyo: true, repeat: 1 });
    try {
      await onPick(code, district);
    } catch (e) {
      setError(e.message);
      setPending(null);
    }
  };

  return (
    <Modal title={texts.picker.title} onClose={onClose} width={560}>
      <div className={styles.districts} role="radiogroup" aria-label={texts.picker.districtLabel}>
        {districts.map((d) => (
          <button
            key={d.slug}
            type="button"
            role="radio"
            aria-checked={district === d.slug}
            className={styles.district}
            onClick={() => {
              setDistrict(d.slug);
              setError('');
            }}
            disabled={pending !== null}
          >
            <span
              className={styles.swatch}
              style={{ background: `var(--district-${d.palette})` }}
              aria-hidden="true"
            />
            {d.name}
          </button>
        ))}
      </div>
      <div ref={gridRef} className={styles.grid} data-ui="mood-grid">
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
            <MoodFace mood={mood.code} size={52} label="" />
            <span>{mood.label}</span>
          </button>
        ))}
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <p className={styles.lead}>{texts.picker.privacy}</p>
    </Modal>
  );
}
