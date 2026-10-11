import { useImperativeHandle, useRef } from 'react';
import { gsap, useGSAP } from '@/shared/animations/gsapSetup';
import { usePageEntered } from '@/shared/hooks/usePageEntered';
import portrait from '../assets/girl-portrait.webp';
import { RISE, riseDelay } from '../lib/rise';
import styles from './HeroPortrait.module.css';

// Рука у подбородка и центр головы на портрете — доли его ширины и высоты; радиус головы — доля
// ширины.
const HAND = { x: 0.43, y: 0.37 };
const HEAD = { x: 0.43, y: 0.22, radius: 0.2 };

const pointOn = (image, root, x, y) => {
  const box = root.getBoundingClientRect();
  return { x: image.left + image.width * x - box.left, y: image.top + image.height * y - box.top };
};

// Лёгкая версия героя: девушка готовым кадром (снят с 3D-сцены) вместо WebGL. Тот же интерфейс,
// что у Hero3D: уход за лист перед картой, взгляд на форму, подскок, точки руки и головы.
// entrance: своё появление — выезд снизу последним (onRisen — когда встала на место); заглушка
// внутри Hero3D его не играет — там выезжает общий слой кадра и холста.
export function HeroPortrait({ ref, stacked = false, entrance = true, onRisen }) {
  const rootRef = useRef(null);
  const imageRef = useRef(null);
  const entered = usePageEntered();

  useGSAP(
    () => {
      if (!entrance) return;
      gsap.set(imageRef.current, { yPercent: 110 });
      if (!entered) return;
      gsap.to(imageRef.current, { yPercent: 0, ...RISE, delay: riseDelay(), onComplete: onRisen });
    },
    { scope: rootRef, dependencies: [entered, entrance] },
  );

  useImperativeHandle(
    ref,
    () => ({
      // Как в 3D: чуть разворачивается и опускается за край листа.
      flyIntoCity: ({ duration = 1.5 } = {}) =>
        gsap.to(imageRef.current, { yPercent: 70, scaleX: 0.92, duration, ease: 'power2.in' }),
      setFlyProgress: (progress) =>
        gsap.set(imageRef.current, { yPercent: progress * 70, scaleX: 1 - progress * 0.08 }),
      // Кадр плоский — «взгляд» на форму передаёт лёгкий сдвиг к колонке.
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
        const image = imageRef.current?.getBoundingClientRect();
        return image ? pointOn(image, rootRef.current, HAND.x, HAND.y) : null;
      },
      headPoint: () => {
        const image = imageRef.current?.getBoundingClientRect();
        if (!image) return null;
        const center = pointOn(image, rootRef.current, HEAD.x, HEAD.y);
        return { ...center, radius: image.width * HEAD.radius };
      },
    }),
    [],
  );

  return (
    <div ref={rootRef} className={styles.root} aria-hidden="true">
      <img
        ref={imageRef}
        className={styles.portrait}
        data-stacked={stacked || undefined}
        src={portrait}
        width="760"
        height="1081"
        alt=""
        draggable="false"
      />
    </div>
  );
}
