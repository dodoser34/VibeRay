import { useRef } from 'react';
import { WIDE_QUERY } from '@/adaptations/core';
import { gsap, useGSAP } from '@/shared/animations/core/gsapSetup';
import { cardEnter } from '@/shared/animations/effects/cardEnter';
import { SITE_URL } from '@/shared/config/site';
import { usePageEntered } from '@/shared/hooks/usePageEntered';
import { Icon } from '@/shared/ui/icons/Icon';
import { QrCode } from '@/shared/ui/qr/QrCode';
import home from '@/texts/ru/home.json';
import styles from './PhoneQr.module.css';

const NARROW_ENTER_DELAY = 0.3;
const AFTER_AUTH = 0.2; // появляется чуть позже карточки входа — следом за ней

// Рядом с карточкой входа: QR-код с адресом сайта — продолжить с телефона. Код в рамке видоискателя,
// по нему медленно проходит линия сканирования. Появляется так же, как карточка входа (cardEnter), —
// внутренняя карточка; ref — внешняя обёртка, которую уводит прокрутка (HomePage): у них разные
// transform, и анимации не перебивают друг друга.
export function PhoneQr({ ref, wideEnterDelay = NARROW_ENTER_DELAY }) {
  const cardRef = useRef(null);
  const entered = usePageEntered();
  const texts = home.phoneQr;

  useGSAP(
    () => {
      if (!entered) return;
      const wide = window.matchMedia(WIDE_QUERY).matches;
      const parts = cardRef.current.querySelectorAll('[data-part]');
      cardEnter(
        gsap.timeline(),
        cardRef.current,
        parts,
        (wide ? wideEnterDelay : NARROW_ENTER_DELAY) + AFTER_AUTH,
      );
    },
    { dependencies: [entered], scope: cardRef },
  );

  return (
    <aside ref={ref} className={styles.shell} data-ui="home-qr">
      <div ref={cardRef} className={styles.card} data-ui="home-qr-card">
        <p className={styles.head} data-ui="home-qr-head" data-part>
          <span className={styles.badge} aria-hidden="true">
            <Icon name="phone" size={16} />
          </span>
          {texts.title}
        </p>
        <div className={styles.frame} data-ui="home-qr-frame" data-part>
          <QrCode className={styles.code} value={SITE_URL} label={texts.label} />
          <span className={styles.scan} aria-hidden="true" />
        </div>
        <p className={styles.text} data-ui="home-qr-text" data-part>
          {texts.text}
        </p>
      </div>
    </aside>
  );
}
