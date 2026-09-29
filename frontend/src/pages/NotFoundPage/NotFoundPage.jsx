import { useRef } from 'react';
import { useLocation } from 'react-router';
import { useTransitionNavigate } from '@/app/transitions/useTransition';
import { gsap, SplitText, useGSAP } from '@/shared/animations/gsapSetup';
import { usePageEntered } from '@/shared/hooks/usePageEntered';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { Button } from '@/shared/ui/Button';
import texts from '@/texts/ru/notFound.json';
import { useLanguage } from '@/shared/hooks/useLanguage';
import { NotFoundMap } from './NotFoundMap';
import styles from './NotFoundPage.module.css';

// Неизвестный адрес: вместо молчаливого переброса на главную — объяснение и дорога обратно.
export function NotFoundPage() {
  // Страница — корень своей ветки: при смене языка перерисовывается вместе со всем содержимым.
  const language = useLanguage();
  const rootRef = useRef(null);
  const { pathname } = useLocation();
  const go = useTransitionNavigate();
  const entered = usePageEntered();
  const reduced = useReducedMotion();

  // Карта разворачивается панель за панелью, прорисовываются улицы и река, у края проступает
  // пустой район, и сверху падает метка с вопросом.
  useGSAP(
    () => {
      if (!entered || reduced) return;
      const split = SplitText.create('[data-title]', { type: 'words', mask: 'words' });
      gsap
        .timeline({ defaults: { ease: 'power3.out' } })
        .from('[data-panel]', {
          scaleX: 0,
          transformOrigin: '0% 50%',
          duration: 0.7,
          stagger: 0.14,
        })
        .from('[data-district]', { autoAlpha: 0, scale: 0.9, duration: 0.6, stagger: 0.05 }, 0.45)
        .from('[data-line]', { strokeDashoffset: 1, duration: 1.1, stagger: 0.08 }, 0.6)
        .from('[data-blank]', { autoAlpha: 0, duration: 0.8 }, 1.1)
        .from('[data-pin-body]', { y: -90, duration: 1, ease: 'bounce.out' }, 1.3)
        .from(
          '[data-pin-shadow]',
          { scale: 0.2, autoAlpha: 0, transformOrigin: '50% 50%', duration: 1 },
          1.3,
        )
        .from(split.words, { yPercent: 110, duration: 0.9, stagger: 0.06 }, 0.2)
        .from('[data-rise]', { y: 20, autoAlpha: 0, duration: 0.7, stagger: 0.08 }, 0.5);
    },
    { scope: rootRef, dependencies: [entered, reduced], revertOnUpdate: true },
  );

  return (
    <div ref={rootRef} className={styles.page} data-ui="not-found">
      <div className={styles.text}>
        <p className={styles.kicker} data-rise>
          {texts.kicker}
        </p>
        <h1 key={language} className={styles.title} data-title>
          {texts.title}
        </h1>
        <p className={styles.lead} data-rise>
          {texts.lead}
        </p>
        <p className={styles.path} data-rise>
          <span className={styles.pathLabel}>{texts.pathLabel}</span>
          <code className={styles.pathValue}>{pathname}</code>
        </p>
        <div className={styles.actions} data-rise data-ui="not-found-actions">
          <Button size="lg" onClick={() => go('/map/kostanay')}>
            {texts.openMap}
          </Button>
          <Button size="lg" variant="ghost" onClick={() => go('/')}>
            {texts.home}
          </Button>
        </div>
        <p className={styles.support} data-rise>
          {texts.support}{' '}
          <Button variant="text" onClick={() => go('/support')}>
            {texts.supportLink}
          </Button>
        </p>
      </div>
      <div className={styles.stage} data-ui="not-found-art">
        <NotFoundMap label={texts.artLabel} />
      </div>
    </div>
  );
}
