import { useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { gsap, useGSAP } from '@/shared/animations/gsapSetup';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { format } from '@/shared/lib/format';
import { Button } from './Button';
import styles from './CoachMarks.module.css';

const GAP = 16; // px между вырезом и карточкой
const EDGE = 16; // px от краёв экрана
const NARROW = 640; // уже этого карточка встаёт у верхнего или нижнего края во всю ширину

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

// Карточка — с той стороны выреза, где больше места; на узком экране — у противоположного края.
function cardPosition(hole, card) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (!hole) return { left: (vw - card.width) / 2, top: (vh - card.height) / 2 };
  if (vw < NARROW) {
    const below = hole.y + hole.height / 2 < vh / 2;
    return { left: EDGE, top: below ? vh - card.height - EDGE * 2 : EDGE * 5 };
  }
  const clampX = (x) => Math.min(Math.max(EDGE, x), vw - card.width - EDGE);
  const clampY = (y) => Math.min(Math.max(EDGE, y), vh - card.height - EDGE);
  const centerX = hole.x + hole.width / 2 - card.width / 2;
  if (hole.y + hole.height + GAP + card.height < vh - EDGE) {
    return { left: clampX(centerX), top: hole.y + hole.height + GAP };
  }
  if (hole.y - GAP - card.height > EDGE) {
    return { left: clampX(centerX), top: hole.y - GAP - card.height };
  }
  const left =
    hole.x + hole.width + GAP + card.width < vw - EDGE
      ? hole.x + hole.width + GAP
      : hole.x - GAP - card.width;
  return { left: clampX(left), top: clampY(hole.y + hole.height / 2 - card.height / 2) };
}

// Пошаговые подсказки поверх страницы: затемнение с вырезом вокруг цели, вырез переезжает между
// шагами, рядом — карточка с текстом. steps: [{ target (CSS-селектор), title, text, padding,
// round }]. Цели двигаются (камера карты, раскладка) — вырез следит за ними каждый кадр.
// onFinish('done' | 'skip').
export function CoachMarks({ steps, labels, onFinish }) {
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
        <div className={styles.card}>
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
