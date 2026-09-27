import { useRef, useState } from 'react';
import { WIDE_QUERY } from '@/adaptations/core';
import { gsap, useGSAP } from '@/shared/animations/gsapSetup';
import { createPuzzle } from '@/shared/animations/puzzlePieces';
import { usePageEntered } from '@/shared/hooks/usePageEntered';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { LoginForm } from './LoginForm';
import { RegisterFlow } from './RegisterFlow';
import styles from './AuthPanel.module.css';

const random = gsap.utils.random;
// На широких экранах карточка ждёт, пока передний лист дотечёт до неё (FrontLayer).
const PUZZLE_DELAY = { wide: 1.2, narrow: 0.3 };
// Куда разлетается и откуда прилетает каждая часть формы: свободный разброс вокруг карточки.
const SCATTER = {
  x: () => random(-150, 150),
  y: () => random(-80, 100),
  rotation: () => random(-18, 18),
  scale: 0.85,
  autoAlpha: 0,
};

// Вход / регистрация. При смене режима текущая форма разлетается по частям, а другая собирается из
// частей; фон карточки плавно подстраивается под новую высоту.
export function AuthPanel({
  ref,
  mode,
  onModeChange,
  districts,
  onDistrictPreview,
  onAuthenticated,
}) {
  const rootRef = useRef(null);
  const bgRef = useRef(null);
  const paneRef = useRef(null);
  const prevHeight = useRef(null);
  const leaving = useRef(null); // анимация разборки текущей формы, если идёт
  const latestMode = useRef(mode);
  const [shown, setShown] = useState(mode);
  const reduced = useReducedMotion();
  const entered = usePageEntered();

  const parts = () => paneRef.current.querySelectorAll('[data-part]');

  // 1) режим сменили снаружи (таб-бар / ссылки): разбираем текущую форму
  useGSAP(
    () => {
      latestMode.current = mode;
      if (mode === shown) {
        // переключили обратно, пока форма разлеталась, — собираем её заново
        if (leaving.current) {
          leaving.current.kill();
          leaving.current = null;
          gsap.to(parts(), { x: 0, y: 0, rotation: 0, scale: 1, autoAlpha: 1, duration: 0.5 });
        }
        return;
      }
      if (leaving.current) return;
      prevHeight.current = rootRef.current.querySelector('[data-card]').offsetHeight;
      leaving.current = gsap.to(parts(), {
        ...SCATTER,
        duration: 0.4,
        ease: 'power2.in',
        stagger: { each: 0.035, from: 'end' },
        onComplete: () => {
          leaving.current = null;
          setShown(latestMode.current);
        },
      });
    },
    { dependencies: [mode], scope: rootRef },
  );

  // 2) новая форма в DOM: собираем её из частей. При первом появлении сначала собирается сама
  // поверхность карточки — из кусочков пазла, летящих из правого нижнего угла.
  useGSAP(
    () => {
      // Первое появление под переходом страницы: собираем, когда страница откроется.
      if (prevHeight.current === null && !entered) return undefined;
      const card = rootRef.current.querySelector('[data-card]');
      const timeline = gsap.timeline();
      let puzzle = null;
      if (prevHeight.current === null && !reduced) {
        const wide = window.matchMedia(WIDE_QUERY).matches;
        puzzle = createPuzzle(card, {
          cols: 4,
          rows: 5,
          radius: parseFloat(getComputedStyle(bgRef.current).borderTopLeftRadius) || 0,
          className: styles.puzzle,
        });
        bgRef.current.after(puzzle.svg); // под формой, выше ничего
        timeline
          .set(bgRef.current, { autoAlpha: 0 })
          .from(
            puzzle.pieces,
            {
              x: () => random(140, 340),
              y: () => random(90, 280),
              rotation: () => random(-55, 55),
              scale: 0.45,
              autoAlpha: 0,
              duration: 0.85,
              ease: 'back.out(1.25)',
              stagger: { amount: 0.7, from: 'end' },
            },
            wide ? PUZZLE_DELAY.wide : PUZZLE_DELAY.narrow,
          )
          // Швы исчезают: сплошная поверхность заменяет собранные кусочки.
          .to(bgRef.current, { autoAlpha: 1, duration: 0.35 })
          .to(puzzle.svg, { autoAlpha: 0, duration: 0.35, onComplete: puzzle.destroy }, '<');
      } else if (prevHeight.current === null) {
        timeline.from(bgRef.current, { autoAlpha: 0, duration: 0.3 });
      } else {
        timeline.fromTo(
          bgRef.current,
          { scaleY: prevHeight.current / card.offsetHeight },
          { scaleY: 1, transformOrigin: '50% 0%', duration: 0.5, ease: 'power3.out' },
        );
      }
      timeline.from(
        parts(),
        { ...SCATTER, duration: 0.75, ease: 'back.out(1.3)', stagger: 0.06 },
        prevHeight.current === null ? '-=0.25' : 0.1,
      );
      return () => puzzle?.destroy();
    },
    { dependencies: [shown, entered], scope: rootRef },
  );

  return (
    <div ref={rootRef} className={styles.root}>
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
