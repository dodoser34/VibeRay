import { useRef } from 'react';
import { gsap, useGSAP } from '@/shared/animations/gsapSetup';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { plural } from '@/shared/lib/plural';
import { FAQ, HELP_CATEGORIES } from '../content';
import texts from '@/texts/support.json';
import styles from './HelpCategories.module.css';

const TILT = 8; // градусов у края карточки

// Темы помощи — карточки, которые наклоняются в 3D за указателем; клик фильтрует FAQ.
export function HelpCategories({ active, onSelect }) {
  const rootRef = useRef(null);
  const reduced = useReducedMotion();

  useGSAP(
    (context, contextSafe) => {
      if (reduced) return undefined;
      const removers = [];
      gsap.utils.toArray('[data-card]', rootRef.current).forEach((card) => {
        const rotateX = gsap.quickTo(card, 'rotateX', { duration: 0.5, ease: 'power3.out' });
        const rotateY = gsap.quickTo(card, 'rotateY', { duration: 0.5, ease: 'power3.out' });
        const onMove = contextSafe((event) => {
          const box = card.getBoundingClientRect();
          const x = (event.clientX - box.left) / box.width - 0.5;
          const y = (event.clientY - box.top) / box.height - 0.5;
          rotateY(x * TILT * 2);
          rotateX(-y * TILT * 2);
          card.style.setProperty('--spot-x', `${(x + 0.5) * 100}%`);
          card.style.setProperty('--spot-y', `${(y + 0.5) * 100}%`);
        });
        const onLeave = contextSafe(() => {
          rotateX(0);
          rotateY(0);
        });
        card.addEventListener('pointermove', onMove);
        card.addEventListener('pointerleave', onLeave);
        removers.push(() => {
          card.removeEventListener('pointermove', onMove);
          card.removeEventListener('pointerleave', onLeave);
        });
      });
      return () => removers.forEach((remove) => remove());
    },
    { scope: rootRef, dependencies: [reduced], revertOnUpdate: true },
  );

  return (
    <ul ref={rootRef} className={styles.grid} data-ui="help-grid">
      {HELP_CATEGORIES.map((category) => {
        const count = FAQ.filter((item) => item.category === category.code).length;
        return (
          <li key={category.code} className={styles.cell}>
            <button
              type="button"
              className={styles.card}
              data-ui="help-card"
              data-card
              data-active={active === category.code || undefined}
              aria-pressed={active === category.code}
              onClick={() => onSelect(active === category.code ? null : category.code)}
            >
              <span className={styles.iconWrap}>
                <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <path d={category.icon} />
                </svg>
              </span>
              <span className={styles.title}>{category.title}</span>
              <span className={styles.text}>{category.text}</span>
              <span className={styles.meta}>
                {count} {plural(count, texts.answersCount)}
                <svg className={styles.arrow} viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 12h14m-5-5 5 5-5 5" />
                </svg>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
