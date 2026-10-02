import { useEffect, useId, useRef, useState } from 'react';
import { gsap, useGSAP } from '@/shared/animations/gsapSetup';
import { usePageEntered } from '@/shared/hooks/usePageEntered';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { useTheme } from '@/shared/hooks/useTheme';
import { createSheetTexture, TILE } from '../lib/sheetTexture';
import styles from './FrontLayer.module.css';

// S-образная кривая из эскиза как физический слой: левый лист (с пропуском жителя) лежит над
// 3D-сценой, город — ниже, за его изогнутым краем. viewBox 1440×900; кривая начинается слева
// сверху, проходит мимо карточки, ныряет под город и уходит за правый край.
const EDGE =
  'M 150 0 C 420 30 590 120 640 330 C 690 540 760 720 960 790 C 1120 845 1300 820 1440 760';
const SHEET = `${EDGE} L 1440 900 L 0 900 L 0 0 Z`;
// Второй, чуть более низкий край даёт листу видимую толщину (как вырезанная бумага).
const THICKNESS = `M 150 0 C 428 34 602 126 654 336 C 704 548 774 730 968 802 C 1126 858 1304 834 1440 776 L 1440 900 L 0 900 L 0 0 Z`;

// «Водопад наоборот»: лист натекает из правого нижнего угла к левому верхнему. Фронт потока — линия
// поперёк этой диагонали, впереди которой бегут струи.
const W = 1440;
const H = 900;
const LENGTH = Math.hypot(W, H);
const DIR = [-W / LENGTH, -H / LENGTH]; // снизу справа → вверх влево
const ACROSS = [-DIR[1], DIR[0]];
const HALF_SPAN = (W * H) / LENGTH; // расстояние от диагонали до дальних углов
const STREAM = 440; // насколько самые длинные струи опережают фронт
const STEPS = 160;

function flowPath(progress, time) {
  const base = progress * (LENGTH + STREAM);
  const calm = 1 - progress ** 3; // струи сливаются, когда лист ложится
  const front = [];
  const back = [];
  for (let i = 0; i <= STEPS; i++) {
    const s = -HALF_SPAN - 40 + ((2 * HALF_SPAN + 80) * i) / STEPS;
    // Несколько наложенных волн → неровные струи разной ширины, которые смещаются вбок.
    const wave =
      0.5 * Math.sin(s * 0.009 + time * 1.4) +
      0.32 * Math.sin(s * 0.023 - time * 2.1 + 1.3) +
      0.18 * Math.sin(s * 0.052 + time * 2.9 + 0.4);
    const lead = Math.max(0, wave + 0.15) ** 1.3; // скруглённые кончики, плоские промежутки
    const advance = Math.max(0, base - STREAM * (1 - lead * calm) * calm - STREAM * (1 - calm));
    const x = W + ACROSS[0] * s;
    const y = H + ACROSS[1] * s;
    front.push(`${(x + DIR[0] * advance).toFixed(1)} ${(y + DIR[1] * advance).toFixed(1)}`);
    back.unshift(`${(x - DIR[0] * 40).toFixed(1)} ${(y - DIR[1] * 40).toFixed(1)}`);
  }
  return `M${front.join('L')}L${back.join('L')}Z`;
}

const FLOW_TIMING = { delay: 0.2, duration: 1.9 };

export function FrontLayer({ className = '' }) {
  const rootRef = useRef(null);
  const clipRef = useRef(null);
  const groupRef = useRef(null);
  const reduced = useReducedMotion();
  const entered = usePageEntered();
  const uid = useId().replace(/:/g, '');
  const clipId = `flow-${uid}`;
  // Текстура листа в виде бумажной карты: бесшовный тайл, рисуется при монтировании и заново при
  // смене темы (цвета — из токенов).
  const [texture, setTexture] = useState(null);
  const theme = useTheme();

  useEffect(() => {
    let url = null;
    let alive = true;
    createSheetTexture().then((created) => {
      url = created;
      if (alive) setTexture(created);
      else if (created) URL.revokeObjectURL(created);
    });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [theme]);

  useGSAP(
    () => {
      // Под переходом страницы лист скрыт и натекает, когда страница откроется.
      if (!entered) {
        groupRef.current.setAttribute('clip-path', `url(#${clipId})`);
        clipRef.current.setAttribute('d', 'M0 0Z');
        return;
      }
      if (reduced) {
        groupRef.current.removeAttribute('clip-path');
        gsap.from(rootRef.current, { autoAlpha: 0, duration: 0.4 });
        return;
      }
      const flow = { progress: 0 };
      const started = performance.now();
      const draw = () => {
        const time = (performance.now() - started) / 1000;
        clipRef.current.setAttribute('d', flowPath(flow.progress, time));
      };
      draw();
      groupRef.current.setAttribute('clip-path', `url(#${clipId})`);
      gsap.to(flow, {
        progress: 1,
        ...FLOW_TIMING,
        ease: 'sine.inOut',
        onUpdate: draw,
        // Лист покрыл всё: снимаем clip, чтобы неподвижный лист ничего не стоил в каждом кадре.
        onComplete: () => groupRef.current?.removeAttribute('clip-path'),
      });
    },
    { scope: rootRef, dependencies: [reduced, entered] },
  );

  return (
    <svg
      ref={rootRef}
      className={`${styles.root} ${className}`}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
          <path ref={clipRef} d="M0 0Z" />
        </clipPath>
        <clipPath id={`sheet-${uid}`} clipPathUnits="userSpaceOnUse">
          <path d={SHEET} />
        </clipPath>
        <pattern id={`paper-${uid}`} patternUnits="userSpaceOnUse" width={TILE} height={TILE}>
          {texture && <image href={texture} width={TILE} height={TILE} />}
        </pattern>
        {/* Тень края проявляется от начала кривой: её толстые штрихи там обрезаны квадратом и
           читались бы как жёсткий блок у верха экрана. */}
        <linearGradient
          id={`shade-fade-${uid}`}
          gradientUnits="userSpaceOnUse"
          x1="150"
          y1="0"
          x2="560"
          y2="160"
        >
          <stop offset="0" className={styles.fadeFrom} />
          <stop offset="1" className={styles.fadeTo} />
        </linearGradient>
        <mask
          id={`shade-mask-${uid}`}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width={W}
          height={H}
          style={{ maskType: 'alpha' }}
        >
          <rect width={W} height={H} fill={`url(#shade-fade-${uid})`} />
        </mask>
        {/* мягкий свет сверху слева: лист читается как освещённая поверхность, а не плоская
           заливка */}
        <radialGradient id={`light-${uid}`} cx="0.12" cy="0.1" r="0.75">
          <stop offset="0" className={styles.lightStart} />
          <stop offset="1" className={styles.lightEnd} />
        </radialGradient>
      </defs>
      <g ref={groupRef}>
        <path d={THICKNESS} className={styles.thickness} />
        <path d={SHEET} className={styles.sheet} />
        <path d={SHEET} fill={`url(#paper-${uid})`} />
        <path d={SHEET} fill={`url(#light-${uid})`} />
        {/* лист темнеет к изогнутому краю (наложенные штрихи — дешёвая мягкая тень) */}
        <g
          clipPath={`url(#sheet-${uid})`}
          mask={`url(#shade-mask-${uid})`}
          className={styles.edgeShade}
        >
          <path d={EDGE} strokeWidth="110" />
          <path d={EDGE} strokeWidth="64" />
          <path d={EDGE} strokeWidth="28" />
        </g>
        <path d={EDGE} className={styles.edge} vectorEffect="non-scaling-stroke" />
      </g>
    </svg>
  );
}
