import { useRef, useState } from 'react';
import { WIDE_QUERY } from '@/adaptations/core';
import { gsap, useGSAP } from '@/shared/animations/core/gsapSetup';
import { usePageEntered } from '@/shared/hooks/usePageEntered';
import { LoginForm } from './LoginForm';
import { RegisterFlow } from './RegisterFlow';
import styles from './AuthPanel.module.css';

// На узких экранах переднего листа нет — карточке ждать нечего.
const NARROW_ENTER_DELAY = 0.3;

// Вход / регистрация. Карточка плавно выдвигается снизу из пустоты; при смене режима текущая форма
// уходит вверх и гаснет, новая поднимается следом, а фон карточки подстраивается под новую высоту.
export function AuthPanel({
  ref,
  mode,
  onModeChange,
  districts,
  onDistrictPreview,
  onAuthenticated,
  wideEnterDelay = NARROW_ENTER_DELAY, // на широких экранах: когда закончится вступление страницы
}) {
  const rootRef = useRef(null);
  const bgRef = useRef(null);
  const paneRef = useRef(null);
  const prevHeight = useRef(null);
  const leaving = useRef(null); // анимация ухода текущей формы, если идёт
  const latestMode = useRef(mode);
  const [shown, setShown] = useState(mode);
  const entered = usePageEntered();

  const parts = () => paneRef.current.querySelectorAll('[data-part]');

  // 1) режим сменили снаружи (таб-бар / ссылки): текущая форма уходит
  useGSAP(
    () => {
      latestMode.current = mode;
      if (mode === shown) {
        // переключили обратно, пока форма уходила, — возвращаем её
        if (leaving.current) {
          leaving.current.kill();
          leaving.current = null;
          gsap.to(parts(), { y: 0, autoAlpha: 1, duration: 0.5, ease: 'power2.out' });
        }
        return;
      }
      if (leaving.current) return;
      prevHeight.current = rootRef.current.querySelector('[data-card]').offsetHeight;
      leaving.current = gsap.to(parts(), {
        y: -10,
        autoAlpha: 0,
        duration: 0.35,
        ease: 'sine.in',
        stagger: 0.025,
        onComplete: () => {
          leaving.current = null;
          setShown(latestMode.current);
        },
      });
    },
    { dependencies: [mode], scope: rootRef },
  );

  // 2) новая форма в DOM. При первом появлении карточка целиком выдвигается снизу и проявляется,
  // поля поднимаются следом с небольшим шагом.
  useGSAP(
    () => {
      // Первое появление под переходом страницы: показываем, когда страница откроется.
      if (prevHeight.current === null && !entered) return;
      const card = rootRef.current.querySelector('[data-card]');
      const timeline = gsap.timeline();
      if (prevHeight.current === null) {
        const wide = window.matchMedia(WIDE_QUERY).matches;
        timeline.from(
          card,
          {
            y: 40,
            scale: 0.98,
            filter: 'blur(6px)',
            autoAlpha: 0,
            transformOrigin: '50% 100%',
            duration: 1.4,
            ease: 'power2.out',
            clearProps: 'transform,filter',
          },
          wide ? wideEnterDelay : NARROW_ENTER_DELAY,
        );
      } else {
        timeline.fromTo(
          bgRef.current,
          { scaleY: prevHeight.current / card.offsetHeight },
          { scaleY: 1, transformOrigin: '50% 0%', duration: 0.6, ease: 'power2.out' },
        );
      }
      timeline.from(
        parts(),
        { y: 14, autoAlpha: 0, duration: 0.9, ease: 'power2.out', stagger: 0.07 },
        prevHeight.current === null ? '<0.45' : 0.15,
      );
    },
    { dependencies: [shown, entered], scope: rootRef },
  );

  return (
    <div ref={rootRef} className={styles.root} data-ui="auth-panel">
      <div ref={ref} className={styles.card} data-card data-ui="auth-card">
        <div ref={bgRef} className={styles.bg} aria-hidden="true" />

        <div ref={paneRef} className={styles.pane} key={shown}>
          {shown === 'login' ? (
            <LoginForm
              onSuccess={(user) => onAuthenticated(user, 'login')}
              onSwitch={() => onModeChange('register')}
            />
          ) : (
            <RegisterFlow
              districts={districts}
              onDistrictPreview={onDistrictPreview}
              onSuccess={(user) => onAuthenticated(user, 'register')}
              onSwitch={() => onModeChange('login')}
            />
          )}
        </div>
      </div>
    </div>
  );
}
