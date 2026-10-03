import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { fallBackToLite } from '@/adaptations/core';
import { subscribeTheme } from '@/shared/lib/theme';
import { usePageEntered } from '@/shared/hooks/usePageEntered';
import styles from './Hero3D.module.css';

// 3D-город героя. Сцена (и three.js) грузится отдельно — в лёгком режиме графики не скачивается.
// stacked: страница в одну колонку (телефоны, планшеты стоя) — город стоит посередине.
export function Hero3D({ ref, city, moods, stacked = false }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [scene, setScene] = useState(null);
  const entered = usePageEntered();

  useEffect(() => {
    let alive = true;
    let current = null;
    import('../scene/HeroScene')
      .then(({ HeroScene }) => {
        if (!alive) return;
        current = new HeroScene(canvasRef.current, containerRef.current);
        setScene(current);
      })
      .catch((error) => {
        console.error('Hero scene failed, switching to light graphics', error);
        fallBackToLite();
      });
    return () => {
      alive = false;
      current?.dispose();
    };
  }, []);

  useEffect(() => {
    if (scene && entered) scene.startIntro();
  }, [scene, entered]);

  useEffect(() => {
    if (scene && city) scene.setCity(city);
  }, [scene, city]);

  useEffect(() => subscribeTheme(() => scene?.refreshTheme()), [scene]);

  useEffect(() => {
    if (scene && moods) scene.setMoods(moods);
  }, [scene, moods]);

  useEffect(() => {
    scene?.setStacked(stacked);
  }, [scene, stacked]);

  useImperativeHandle(
    ref,
    () => ({
      flyIntoCity: (options) => scene?.flyIntoCity(options),
      setFlyProgress: (progress) => scene?.setFlyProgress(progress),
      highlightDistrict: (slug) => scene?.highlightDistrict(slug),
      flashDistrict: (slug) => scene?.flashDistrict(slug),
      districtScreenPosition: (slug) => scene?.districtScreenPosition(slug) ?? null,
    }),
    [scene],
  );

  return (
    <div ref={containerRef} className={styles.root} aria-hidden="true">
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}
