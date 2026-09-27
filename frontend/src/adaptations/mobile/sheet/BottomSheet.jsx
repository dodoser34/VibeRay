import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { gsap } from '@/shared/animations/gsapSetup';
import styles from './BottomSheet.module.css';

const SNAPS = ['peek', 'half', 'full'];
const FLICK = 0.45; // px/мс: быстрый взмах переводит шторку на положение дальше даже при коротком жесте

// Видимая высота (px) положений шторки для окна этой высоты.
function snapHeights(viewport, peek, top) {
  return { peek, half: Math.round(viewport * 0.52), full: viewport - top };
}

const nearest = (heights, visible) =>
  SNAPS.reduce((best, key) =>
    Math.abs(heights[key] - visible) < Math.abs(heights[best] - visible) ? key : best,
  );

// Шторка у нижнего края с тремя положениями: «peek» (виден только заголовок), «half» и «full».
// Двигается за ручку и за элементы с data-sheet-drag (заголовки панелей; их кнопки остаются
// кликабельными). Движение — через transform; блок содержимого всегда равен видимой части, поэтому
// панели прокручиваются внутри, а их нижние кнопки остаются на экране в любом положении.
// onInset(px) сообщает видимую высоту во время движения (карта сдвигает по ней камеру и плавающие
// кнопки).
export function BottomSheet({
  snap,
  onSnapChange,
  onInset,
  label,
  toggleLabel,
  peek = 96,
  top = 72,
  children,
}) {
  const sheetRef = useRef(null);
  const contentRef = useRef(null);
  const stateRef = useRef({ visible: 0, viewport: 0, drag: null, tween: null });
  const snapRef = useRef(snap);
  const onInsetRef = useRef(onInset);

  useEffect(() => {
    onInsetRef.current = onInset;
    snapRef.current = snap;
  });

  const heights = useCallback(() => snapHeights(stateRef.current.viewport, peek, top), [peek, top]);

  const apply = useCallback(
    (visible) => {
      stateRef.current.visible = visible;
      sheetRef.current.style.transform = `translateY(${heights().full - visible}px)`;
      contentRef.current.style.height = `${visible}px`;
      onInsetRef.current?.(visible);
    },
    [heights],
  );

  const animateTo = useCallback(
    (name, duration = 0.45) => {
      const state = stateRef.current;
      const proxy = { v: state.visible };
      state.tween?.kill();
      state.tween = gsap.to(proxy, {
        v: heights()[name],
        duration,
        ease: 'expo.out',
        onUpdate: () => apply(proxy.v),
      });
    },
    [apply, heights],
  );

  // Шторка высотой с положение full; поворот и ресайз пересчитывают её.
  useLayoutEffect(() => {
    const measure = () => {
      stateRef.current.viewport = window.visualViewport?.height ?? window.innerHeight;
      sheetRef.current.style.height = `${heights().full}px`;
      apply(heights()[snapRef.current]);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [apply, heights]);

  useEffect(() => {
    animateTo(snap);
  }, [snap, animateTo]);

  useEffect(() => () => stateRef.current.tween?.kill(), []);

  const next = { peek: 'half', half: 'full', full: 'peek' }[snap];

  const onPointerDown = (event) => {
    const onHandle = event.target.closest('[data-sheet-handle]');
    const onHeader = event.target.closest('[data-sheet-drag]');
    if (!onHandle && (!onHeader || event.target.closest('button, a, input'))) return;
    const state = stateRef.current;
    state.tween?.kill();
    state.drag = { y: event.clientY, start: state.visible, moved: false, trail: [], onHandle };
    // Захват сразу: при быстром взмахе следующая точка может оказаться уже за пределами шторки.
    sheetRef.current.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event) => {
    const { drag } = stateRef.current;
    if (!drag) return;
    const dy = event.clientY - drag.y;
    if (!drag.moved && Math.abs(dy) > 4) drag.moved = true;
    if (!drag.moved) return;
    const { peek: min, full: max } = heights();
    apply(Math.min(max, Math.max(min, drag.start - dy)));
    drag.trail = [...drag.trail.slice(-4), { y: event.clientY, t: event.timeStamp }];
  };

  const onPointerUp = () => {
    const state = stateRef.current;
    const { drag } = state;
    state.drag = null;
    if (!drag) return;
    // Тап по ручке переключает положение (из-за захвата указателя клик по кнопке не приходит).
    if (!drag.moved) {
      if (drag.onHandle) onSnapChange(next);
      return;
    }
    if (!drag.trail.length) return;
    const first = drag.trail[0];
    const last = drag.trail.at(-1);
    const velocity = last.t > first.t ? (last.y - first.y) / (last.t - first.t) : 0;
    const all = heights();
    let name = nearest(all, state.visible);
    if (Math.abs(velocity) > FLICK) {
      const from = SNAPS.indexOf(nearest(all, drag.start));
      const step = velocity < 0 ? 1 : -1;
      name = SNAPS[Math.min(SNAPS.length - 1, Math.max(0, from + step))];
    }
    if (name === snapRef.current) animateTo(name, 0.35);
    else onSnapChange(name);
  };

  return (
    <section
      ref={sheetRef}
      className={styles.sheet}
      aria-label={label}
      data-snap={snap}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div ref={contentRef} className={styles.content}>
        <button
          type="button"
          className={styles.handle}
          data-sheet-handle
          aria-label={toggleLabel}
          aria-expanded={snap !== 'peek'}
          // Только клавиатура (Enter / Space): тапы указателем обрабатываются в onPointerUp
          onClick={(event) => event.detail === 0 && onSnapChange(next)}
        >
          <span className={styles.grip} aria-hidden="true" />
        </button>
        <div className={styles.body}>{children}</div>
      </div>
    </section>
  );
}
