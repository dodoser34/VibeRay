import { useEffect, useImperativeHandle, useRef } from 'react';
import { usePageEntered } from '@/shared/hooks/usePageEntered';
import { MapScene } from '../scene/MapScene';
import texts from '@/texts/map.json';
import styles from './MapCanvas.module.css';

export function MapCanvas({
  ref,
  city,
  moods,
  problems,
  layer,
  overlay = null,
  selectedSlug,
  onHover,
  onSelectDistrict,
  onSelectProblem,
  placing = false,
  onPlace,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const entered = usePageEntered();
  const callbacksRef = useRef({ onHover, onSelectDistrict, onSelectProblem, onPlace });

  useEffect(() => {
    callbacksRef.current = { onHover, onSelectDistrict, onSelectProblem, onPlace };
  });

  useEffect(() => {
    const scene = new MapScene(canvasRef.current, containerRef.current, {
      labelClassName: styles.label,
      labelValueClassName: styles.labelValue,
      onHover: (hit) => callbacksRef.current.onHover?.(hit),
      onSelectDistrict: (slug) => callbacksRef.current.onSelectDistrict?.(slug),
      onSelectProblem: (problem) => callbacksRef.current.onSelectProblem?.(problem),
    });
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
    if (problems) sceneRef.current.setProblems(problems);
  }, [problems]);

  useEffect(() => {
    sceneRef.current.setLayer(layer);
  }, [layer]);

  useEffect(() => {
    sceneRef.current.setOverlay(overlay);
  }, [overlay]);

  useEffect(() => {
    sceneRef.current.selectDistrict(selectedSlug ?? null);
  }, [selectedSlug]);

  // «Сообщить о проблеме»: в режиме выбора места клик по району ставит метку в эту точку.
  useEffect(() => {
    const scene = sceneRef.current;
    if (placing) scene.startPlacing((placement) => callbacksRef.current.onPlace?.(placement));
    return () => scene.stopPlacing();
  }, [placing]);

  useImperativeHandle(
    ref,
    () => ({
      flashDistrict: (slug) => sceneRef.current?.flashDistrict(slug),
      previewDistrict: (slug) => sceneRef.current?.previewDistrict(slug),
      setViewInset: (bottom) => sceneRef.current?.setViewInset(bottom),
      recenter: () => sceneRef.current?.recenter(),
      focusProblem: (problem) => sceneRef.current?.focusProblem(problem),
    }),
    [],
  );

  return (
    <div ref={containerRef} className={styles.root}>
      <canvas ref={canvasRef} className={styles.canvas} aria-label={texts.canvasLabel} />
    </div>
  );
}
