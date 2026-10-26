import { useId, useImperativeHandle, useRef } from 'react';
import { gsap, useGSAP } from '@/shared/animations/core/gsapSetup';
import { usePageEntered } from '@/shared/hooks/usePageEntered';
import girl from '../assets/girl.webp';
import { usePointerParallax } from '../hooks/usePointerParallax';
import { RISE, riseDelay } from '../lib/rise';
import { ABOVE_EDGE, SHEET_FLY_SHIFT } from '../lib/sheetEdge';
import styles from './HeroGirl.module.css';

// Параллакс: девушка поворачивается к указателю в перспективе и чуть сдвигается — объём без 3D.
// Свойства не пересекаются с выездом (yPercent), взглядом (x) и подскоком (y).
const TILT = {
  move: (px, py) => ({ rotationY: px * 7, rotationX: -py * 4, xPercent: px * 1.2 }),
  idle: (t) => ({ rotationY: t * 3, rotationX: t * -1 }),
};

// Исходник картинки: 1355 × 1161. Кулак у щеки и центр головы — доли нарисованной картинки;
// радиус головы — доля её ширины.
const RATIO = 1355 / 1161;
const HAND = { x: 0.45, y: 0.49 };
const HEAD = { x: 0.51, y: 0.3, radius: 0.17 };

// Картинка вписана в свою рамку с сохранением пропорций (object-fit: contain) и прижата к низу —
// точки считаются по реально нарисованной области, а не по рамке.
function drawnRect(image) {
  const box = image.getBoundingClientRect();
  const width = Math.min(box.width, box.height * RATIO);
  const height = width / RATIO;
  const [x] = getComputedStyle(image).objectPosition.split(' ');
  const share = x.endsWith('%') ? parseFloat(x) / 100 : 0.5;
  return {
    left: box.left + (box.width - width) * share,
    top: box.bottom - height,
    width,
    height,
  };
}

// Девушка героя главной — иллюстрация (прозрачный фон). Появление — выезд снизу последним, после
// всего вступления главной (onRisen — когда встала на место). Команды страницы: уход за край листа
// перед картой, взгляд в сторону формы, подскок радости, точки руки (куда летит метка жителя) и
// головы (вокруг неё всплывают мысли).
export function HeroGirl({ ref, stacked = false, onRisen }) {
  const rootRef = useRef(null);
  const imageRef = useRef(null);
  const clipRef = useRef(null);
  const entered = usePageEntered();
  const clipId = `girl-clip-${useId().replace(/:/g, '')}`;
  usePointerParallax(imageRef, TILT);

  useGSAP(
    () => {
      gsap.set(imageRef.current, {
        yPercent: 110,
        transformPerspective: 1100,
        transformOrigin: '50% 60%',
      });
      if (!entered) return;
      gsap.to(imageRef.current, { yPercent: 0, ...RISE, delay: riseDelay(), onComplete: onRisen });
    },
    { scope: rootRef, dependencies: [entered] },
  );

  useImperativeHandle(ref, () => {
    const pointOn = (x, y) => {
      const image = drawnRect(imageRef.current);
      const root = rootRef.current.getBoundingClientRect();
      return {
        x: image.left + image.width * x - root.left,
        y: image.top + image.height * y - root.top,
        width: image.width,
      };
    };
    return {
      setFlyProgress: (progress) => {
        gsap.set(imageRef.current, { yPercent: progress * 70 });
        // Лист опускается при прокрутке — край обрезки едет вместе с ним.
        clipRef.current?.setAttribute('transform', `translate(0 ${progress * SHEET_FLY_SHIFT})`);
      },
      glance: () =>
        gsap.fromTo(
          imageRef.current,
          { x: 0 },
          { x: -14, duration: 0.3, ease: 'power2.out', yoyo: true, repeat: 1, repeatDelay: 0.25 },
        ),
      cheer: () =>
        gsap.fromTo(
          imageRef.current,
          { y: 0 },
          { y: -18, duration: 0.25, ease: 'power2.out', yoyo: true, repeat: 1 },
        ),
      catchPoint: () => {
        if (!imageRef.current) return null;
        const { x, y } = pointOn(HAND.x, HAND.y);
        return { x, y };
      },
      headPoint: () => {
        if (!imageRef.current) return null;
        const { x, y, width } = pointOn(HEAD.x, HEAD.y);
        return { x, y, radius: width * HEAD.radius };
      },
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={styles.root}
      // На широком экране девушка видна только над краем переднего листа: лист полупрозрачен, и
      // низ картинки иначе просвечивал бы сквозь него. В одну колонку листа нет.
      style={stacked ? undefined : { clipPath: `url(#${clipId})` }}
      aria-hidden="true"
    >
      <svg className={styles.clip} width="0" height="0" focusable="false">
        <clipPath id={clipId} clipPathUnits="objectBoundingBox">
          <path ref={clipRef} d={ABOVE_EDGE} />
        </clipPath>
      </svg>
      {/* Один файл в полном разрешении на всех экранах: уменьшенная копия на ноутбуках и телефонах
          выглядела мыльной. */}
      <img
        ref={imageRef}
        className={styles.girl}
        data-ui="home-girl"
        data-stacked={stacked || undefined}
        src={girl}
        width="1355"
        height="1161"
        alt=""
        draggable="false"
        decoding="async"
        fetchPriority="high" // главная картинка первого экрана — грузится раньше остального
      />
    </div>
  );
}
