import { useLayoutEffect, useRef } from 'react';
import { gsap } from '@/shared/animations/core/gsapSetup';
import { useLanguage } from '@/shared/hooks/useLanguage';
import { prefersReducedMotion } from '@/shared/hooks/useReducedMotion';

const LEAD = 0.28;
const TRAIL = 0.55;
const SQUASH_PX = 2;

// Подложка выбранного варианта в переключателе перетекает к новому варианту: передний край
// убегает вперёд, задний догоняет, на ходу подложка чуть сплющивается — как капля. Работает и в
// сетке вариантов (города в несколько рядов): края по вертикали ведут себя так же.
// rootRef — контейнер вариантов (position: relative), thumbRef — подложка (position: absolute,
// top: 0, left: 0, visibility: hidden до первой расстановки), selector — выбранный вариант.
export function useSlidingThumb(rootRef, thumbRef, value, selector = '[aria-checked="true"]') {
  const language = useLanguage();
  const stateRef = useRef({ placed: false, timeline: null, box: null, size: null });

  // Ширина контейнера изменилась (панель, окно, шрифты, свёрнутый переключатель языка) — подложка
  // встаёт на место выбранного варианта без анимации. Первый вызов наблюдателя приходит сразу
  // после подписки — его пропускаем, иначе он гасил бы переезд.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const state = stateRef.current;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const size = `${width}x${height}`;
      if (state.size === null || state.size === size) {
        state.size = size;
        return;
      }
      state.size = size;
      state.jump?.();
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, [rootRef]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const thumb = thumbRef.current;
    const state = stateRef.current;

    const measure = () => {
      const active = root.querySelector(selector);
      if (!active || !active.offsetWidth) return null;
      return {
        left: active.offsetLeft,
        top: active.offsetTop,
        right: active.offsetLeft + active.offsetWidth,
        bottom: active.offsetTop + active.offsetHeight,
        squash: 0,
      };
    };

    const render = () => {
      const { left, top, right, bottom, squash } = state.box;
      gsap.set(thumb, {
        x: left,
        y: top + squash,
        width: right - left,
        height: bottom - top - squash * 2,
      });
    };

    const jump = () => {
      state.timeline?.kill();
      const target = measure();
      if (!target) {
        gsap.set(thumb, { autoAlpha: 0 });
        state.placed = false;
        return;
      }
      state.box = target;
      render();
      gsap.set(thumb, { autoAlpha: 1 });
      state.placed = true;
    };
    state.jump = jump;

    const target = measure();
    const from = state.box;
    const same =
      from &&
      target &&
      from.left === target.left &&
      from.top === target.top &&
      from.right === target.right &&
      from.bottom === target.bottom;
    if (!state.placed || !target || same || prefersReducedMotion()) {
      jump();
      return;
    }

    state.timeline?.kill();
    state.box = { ...from, squash: 0 };
    const forward = target.left >= from.left;
    const down = target.top >= from.top;
    const timeline = gsap.timeline({ onUpdate: render, defaults: { ease: 'power3.out' } });
    timeline
      .to(state.box, { right: target.right, duration: forward ? LEAD : TRAIL }, 0)
      .to(state.box, { left: target.left, duration: forward ? TRAIL : LEAD }, 0)
      .to(state.box, { bottom: target.bottom, duration: down ? LEAD : TRAIL }, 0)
      .to(state.box, { top: target.top, duration: down ? TRAIL : LEAD }, 0)
      .to(
        state.box,
        { squash: SQUASH_PX, duration: 0.16, ease: 'power2.out', yoyo: true, repeat: 1 },
        0,
      );
    state.timeline = timeline;
  }, [rootRef, thumbRef, value, selector, language]);

  useLayoutEffect(() => {
    const state = stateRef.current;
    return () => state.timeline?.kill();
  }, []);
}
