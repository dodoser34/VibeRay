import { useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { isPhoneWidth, placeInViewport, viewportBounds } from '@/adaptations/core';
import { gsap, useGSAP } from '@/shared/animations/core/gsapSetup';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { format } from '@/shared/lib/i18n/format';
import { Button } from '../controls/Button';
import styles from './CoachMarks.module.css';

const GAP = 16; // px между вырезом и карточкой
const EDGE = 16; // px от краёв экрана

// Первый элемент, который виден на экране (одна подсказка — разные цели на десктопе и телефоне).
function findTarget(selector) {
  return [...document.querySelectorAll(selector)].find((element) => {
    const box = element.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== 'hidden';
  });
}

function holeFor(step) {
  const element = findTarget(step.target);
  if (!element) return null;
  const box = element.getBoundingClientRect();
  const pad = step.padding ?? 10;
  return {
    x: box.left - pad,
    y: box.top - pad,
    width: box.width + pad * 2,
    height: box.height + pad * 2,
    radius: step.round ? (box.height + pad * 2) / 2 : 16,
  };
}

// Карточка — с той стороны выреза, где она помещается (снизу, сверху, справа, слева), и целиком в
// окне (placeInViewport); на телефоне — у противоположного вырезу края во всю ширину.
function cardPosition(hole, card) {
  const bounds = viewportBounds(EDGE);
  if (!hole) {
    return {
      left: bounds.left + (bounds.width - card.width) / 2,
      top: bounds.top + Math.max(0, (bounds.height - card.height) / 2),
    };
  }
  if (isPhoneWidth(window.innerWidth)) {
    const below = hole.y + hole.height / 2 < bounds.top + bounds.height / 2;
    const top = below ? bounds.bottom - card.height - EDGE : EDGE * 5;
    return {
      left: bounds.left,
      top: Math.max(bounds.top, Math.min(top, bounds.bottom - card.height)),
    };
  }
  const { x, y } = placeInViewport({
    anchor: {
      left: hole.x,
      top: hole.y,
      right: hole.x + hole.width,
      bottom: hole.y + hole.height,
    },
    size: card,
    gap: GAP,
    align: 'center',
    bounds,
  });
  return { left: x, top: y };
}

// Пошаговые подсказки поверх страницы: затемнение с вырезом вокруг цели, вырез переезжает между
// шагами, рядом — карточка с текстом. steps: [{ target (CSS-селектор), title, text, padding,
// round }]. Цели двигаются (камера карты, раскладка) — вырез следит за ними каждый кадр.
// figure — портрет гида в карточке (необязательно). onFinish('done' | 'skip').
export function CoachMarks({ steps, labels, figure, onFinish }) {
  const [index, setIndex] = useState(0);
  const rootRef = useRef(null);
  const holeRef = useRef(null);
  const cardRef = useRef(null);
  const currentRef = useRef(null);
  const reduced = useReducedMotion();
  const titleId = useId();
  const textId = useId();
  const step = steps[index];
  const last = index === steps.length - 1;

  // Вырез и карточка следуют за целью; при смене шага вырез плавно переезжает.
  useLayoutEffect(() => {
    let frame = 0;
    let first = true;
    const place = () => {
      const hole = holeFor(step);
      const target = hole ?? {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        width: 0,
        height: 0,
        radius: 0,
      };
      const attrs = {
        x: target.x,
        y: target.y,
        width: target.width,
        height: target.height,
        rx: target.radius,
      };
      if (first) {
        first = false;
        gsap.to(holeRef.current, {
          attr: attrs,
          duration: reduced || !currentRef.current ? 0 : 0.6,
          ease: 'power3.inOut',
          overwrite: true,
          onComplete: () => (currentRef.current = step),
        });
      } else if (currentRef.current === step) {
        gsap.set(holeRef.current, { attr: attrs });
      }
      const card = cardRef.current.getBoundingClientRect();
      const { left, top } = cardPosition(hole, card);
      gsap.set(cardRef.current, { x: left, y: top });
      frame = requestAnimationFrame(place);
    };
    place();
    return () => cancelAnimationFrame(frame);
  }, [step, reduced]);

  useGSAP(
    () => {
      if (!reduced) {
        gsap.fromTo(
          cardRef.current.firstElementChild,
          { autoAlpha: 0, y: 10 },
          { autoAlpha: 1, y: 0, duration: 0.45, ease: 'power3.out' },
        );
      }
      cardRef.current.querySelector('[data-primary]')?.focus();
    },
    { scope: rootRef, dependencies: [index, reduced] },
  );

  useGSAP(
    () => {
      if (!reduced) gsap.from(rootRef.current, { autoAlpha: 0, duration: 0.4 });
    },
    { scope: rootRef },
  );

  const next = () => (last ? onFinish('done') : setIndex(index + 1));
  const back = () => index > 0 && setIndex(index - 1);

  // Фокус не уходит из карточки: Tab ходит по её кнопкам по кругу.
  const onKeyDown = (event) => {
    if (event.key === 'Tab') {
      const buttons = [...cardRef.current.querySelectorAll('button')];
      const at = buttons.indexOf(document.activeElement);
      const to = event.shiftKey
        ? at <= 0
          ? buttons.length - 1
          : at - 1
        : (at + 1) % buttons.length;
      event.preventDefault();
      buttons[to]?.focus();
    } else if (event.key === 'Escape') onFinish('skip');
    else if (event.key === 'ArrowRight') next();
    else if (event.key === 'ArrowLeft') back();
  };

  return createPortal(
    <div
      ref={rootRef}
      className={styles.root}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={textId}
      onKeyDown={onKeyDown}
      data-ui="coach-marks"
    >
      <svg className={styles.shade} aria-hidden="true">
        <defs>
          <mask id={`${titleId}-mask`}>
            <rect width="100%" height="100%" fill="white" />
            <rect ref={holeRef} fill="black" />
          </mask>
        </defs>
        <rect width="100%" height="100%" mask={`url(#${titleId}-mask)`} className={styles.dim} />
      </svg>

      <div ref={cardRef} className={styles.cardSlot}>
        <div className={styles.card} data-ui="coach-card">
          {figure && (
            <img
              className={styles.figure}
              src={figure}
              width="256"
              height="256"
              alt=""
              draggable="false"
            />
          )}
          <p className={styles.progress}>
            {format(labels.progress, { current: index + 1, total: steps.length })}
          </p>
          <h2 id={titleId} className={styles.title}>
            {step.title}
          </h2>
          <p id={textId} className={styles.text}>
            {step.text}
          </p>
          <div className={styles.footer}>
            <div className={styles.dots} aria-hidden="true">
              {steps.map((item, i) => (
                <span key={item.title} data-active={i === index || undefined} />
              ))}
            </div>
            <div className={styles.buttons}>
              {!last && (
                <Button variant="text" onClick={() => onFinish('skip')}>
                  {labels.skip}
                </Button>
              )}
              <Button size="sm" onClick={next} data-primary>
                {last ? labels.done : labels.next}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
