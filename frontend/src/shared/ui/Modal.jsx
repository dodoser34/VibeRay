import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { BREAKPOINTS } from '@/adaptations/core';
import { gsap, useGSAP } from '@/shared/animations/gsapSetup';
import common from '@/texts/ru/common.json';
import styles from './Modal.module.css';
import { Icon } from './Icon';

export function Modal({ title, onClose, children, width = 460 }) {
  const titleId = useId();
  const rootRef = useRef(null);
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useGSAP(
    () => {
      gsap.from(rootRef.current, { autoAlpha: 0, duration: 0.3 });
      // Телефоны показывают диалог шторкой (adaptations/mobile/modal.css): он поднимается от
      // нижнего края, а не увеличивается.
      const sheet = window.innerWidth < BREAKPOINTS.tablet;
      gsap.from(panelRef.current, {
        ...(sheet ? { yPercent: 100 } : { y: 30, scale: 0.96, autoAlpha: 0 }),
        duration: sheet ? 0.45 : 0.55,
        ease: 'expo.out',
      });
    },
    { scope: rootRef },
  );

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    panelRef.current
      .querySelector('button, [href], input, [tabindex]:not([tabindex="-1"])')
      ?.focus();
    const onKeyDown = (event) => event.key === 'Escape' && onCloseRef.current();
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, []);

  return createPortal(
    <div
      ref={rootRef}
      className={styles.overlay}
      data-ui="modal-overlay"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panelRef}
        className={styles.panel}
        data-ui="modal-panel"
        style={{ '--modal-width': `${width / 16}rem` }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <button
            type="button"
            className={styles.close}
            data-ui="modal-close"
            onClick={onClose}
            aria-label={common.close}
          >
            <Icon name="close" size={14} />
          </button>
        </header>
        {children}
      </div>
    </div>,
    document.body,
  );
}
