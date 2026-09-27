import { useEffect, useImperativeHandle, useRef } from 'react';
import { usePageEntered } from '@/shared/hooks/usePageEntered';
import { HeroScene } from '../scene/HeroScene';
import styles from './HeroCanvas.module.css';

// stacked: страница в одну колонку (телефоны, планшеты стоя) — город стоит посередине.
export function HeroCanvas({ ref, city, moods, stacked = false }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const entered = usePageEntered();

  useEffect(() => {
    const scene = new HeroScene(canvasRef.current, containerRef.current);
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (entered) sceneRef.current.startIntro();
  }, [entered]);

  useEffect(() => {
    if (city) sceneRef.current.setCity(city);
  }, [city]);

  useEffect(() => {
    if (moods) sceneRef.current.setMoods(moods);
  }, [moods]);

  useEffect(() => {
    sceneRef.current.setStacked(stacked);
  }, [stacked]);

  useImperativeHandle(
    ref,
    () => ({
      flyIntoCity: (options) => sceneRef.current?.flyIntoCity(options),
      setFlyProgress: (progress) => sceneRef.current?.setFlyProgress(progress),
      highlightDistrict: (slug) => sceneRef.current?.highlightDistrict(slug),
      flashDistrict: (slug) => sceneRef.current?.flashDistrict(slug),
      districtScreenPosition: (slug) => sceneRef.current?.districtScreenPosition(slug) ?? null,
    }),
    [],
  );

  return (
    <div ref={containerRef} className={styles.root} aria-hidden="true">
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}
