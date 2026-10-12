import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { fallBackToLite } from '@/adaptations/core';
import { gsap, useGSAP } from '@/shared/animations/gsapSetup';
import { usePageEntered } from '@/shared/hooks/usePageEntered';
import { subscribeTheme } from '@/shared/lib/theme';
import { RISE, riseDelay } from '../lib/rise';
import styles from './Hero3D.module.css';

// Сцена не запустилась (нет WebGL и т.п.): остальные 3D-сцены сайта переходят в лёгкий режим,
// а место девушки остаётся пустым — другой версии героини нет.
const onSceneError = (error) => {
  console.error('Hero scene failed', error);
  fallBackToLite();
};

// 3D-девушка героя — всегда модель максимального качества (girl-bust.glb). Сцена, three.js и модель
// грузятся отдельно; холст плавно проявляется, когда модель загружена. Появление — выезд снизу
// последним, после всего вступления главной (onRisen — когда встала на место).
// stacked: страница в одну колонку (телефоны, планшеты стоя) — девушка посередине.
export function Hero3D({ ref, stacked = false, onRisen }) {
  const rootRef = useRef(null);
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
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
          onError: onSceneError,
        });
        setScene(current);
      })
      .catch(onSceneError);
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
    },
    { scope: rootRef, dependencies: [ready] },
  );

  useEffect(() => subscribeTheme(() => scene?.refreshTheme()), [scene]);

  useEffect(() => {
    scene?.setStacked(stacked);
  }, [scene, stacked]);

  // Команды страницы (уход за лист, взгляд, подскок, точки руки и головы). Пока модель грузится,
  // сцена уже принимает их, а точки руки и головы возвращает null — мысли и метка подождут.
  useImperativeHandle(
    ref,
    () => ({
      flyIntoCity: (options) => scene?.flyIntoCity(options),
      setFlyProgress: (progress) => scene?.setFlyProgress(progress),
      glance: () => scene?.glance(),
      cheer: () => scene?.cheer(),
      catchPoint: () => scene?.catchPoint() ?? null,
      headPoint: () => scene?.headPoint() ?? null,
    }),
    [scene],
  );

  return (
    <div ref={rootRef} className={styles.root} aria-hidden="true">
      <div className={styles.lift} data-lift>
        <div ref={containerRef} className={styles.stage}>
          <canvas ref={canvasRef} className={styles.canvas} data-canvas />
        </div>
      </div>
    </div>
  );
}
