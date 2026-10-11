import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { fallBackToLite } from '@/adaptations/core';
import { gsap, useGSAP } from '@/shared/animations/gsapSetup';
import { usePageEntered } from '@/shared/hooks/usePageEntered';
import { subscribeTheme } from '@/shared/lib/theme';
import { RISE, riseDelay } from '../lib/rise';
import { HeroPortrait } from './HeroPortrait';
import styles from './Hero3D.module.css';

const toLite = (error) => {
  console.error('Hero scene failed, switching to light graphics', error);
  fallBackToLite();
};

// 3D-девушка героя. Сцена, three.js и модель грузятся отдельно — в лёгком режиме графики не
// скачиваются. Модель тяжёлая, поэтому пока она грузится, на её месте стоит готовый кадр той же
// сцены (HeroPortrait); загрузилась — кадр плавно сменяется 3D. Появление — выезд снизу последним,
// после всего вступления главной (onRisen — когда встала на место); оно общее для кадра и холста:
// они движутся одним слоем и не расходятся, когда бы модель ни пришла.
// stacked: страница в одну колонку (телефоны, планшеты стоя) — девушка посередине.
export function Hero3D({ ref, stacked = false, onRisen }) {
  const rootRef = useRef(null);
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const portraitRef = useRef(null);
  const [scene, setScene] = useState(null);
  const [ready, setReady] = useState(false);
  const entered = usePageEntered();

  useEffect(() => {
    let alive = true;
    let current = null;
    import('../scene/GirlScene')
      .then(({ GirlScene }) => {
        if (!alive) return;
        current = new GirlScene(canvasRef.current, containerRef.current, {
          onReady: () => alive && setReady(true),
          onError: toLite,
        });
        setScene(current);
      })
      .catch(toLite);
    return () => {
      alive = false;
      current?.dispose();
    };
  }, []);

  useGSAP(
    () => {
      gsap.set('[data-lift]', { yPercent: 100 });
      if (!entered) return;
      gsap.to('[data-lift]', { yPercent: 0, ...RISE, delay: riseDelay(), onComplete: onRisen });
    },
    { scope: rootRef, dependencies: [entered] },
  );

  useGSAP(
    () => {
      if (!ready) return;
      gsap.to('[data-canvas]', { autoAlpha: 1, duration: 0.9, ease: 'power2.out' });
      gsap.to('[data-placeholder]', { autoAlpha: 0, duration: 0.9, ease: 'power2.out' });
    },
    { scope: rootRef, dependencies: [ready] },
  );

  useEffect(() => subscribeTheme(() => scene?.refreshTheme()), [scene]);

  useEffect(() => {
    scene?.setStacked(stacked);
  }, [scene, stacked]);

  // Пока модели нет, команды страницы (уход за лист, взгляд, подскок, точки руки и головы) выполняет
  // кадр.
  useImperativeHandle(ref, () => {
    const target = () => (ready ? scene : portraitRef.current);
    return {
      flyIntoCity: (options) => target()?.flyIntoCity(options),
      setFlyProgress: (progress) => target()?.setFlyProgress(progress),
      glance: () => target()?.glance(),
      cheer: () => target()?.cheer(),
      catchPoint: () => target()?.catchPoint() ?? null,
      headPoint: () => target()?.headPoint() ?? null,
    };
  }, [scene, ready]);

  return (
    <div ref={rootRef} className={styles.root} aria-hidden="true">
      <div className={styles.lift} data-lift>
        <div className={styles.placeholder} data-placeholder>
          <HeroPortrait ref={portraitRef} stacked={stacked} entrance={false} />
        </div>
        <div ref={containerRef} className={styles.stage}>
          <canvas ref={canvasRef} className={styles.canvas} data-canvas />
        </div>
      </div>
    </div>
  );
}
