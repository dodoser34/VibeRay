import { useEffect, useImperativeHandle, useRef } from 'react';
import { usePageEntered } from '@/shared/hooks/usePageEntered';
import { format } from '@/shared/lib/format';
import { plural } from '@/shared/lib/plural';
import { subscribeTheme } from '@/shared/lib/theme';
import { MapScene } from '../scene/MapScene';
import texts from '@/texts/ru/map.json';
import styles from './MapCanvas.module.css';

export function MapCanvas({
  ref,
  city,
  moods,
  problems,
  layer,
  overlay = null,
  heightScale = 1,
  selectedSlug,
  selectedProblemId = null,
  hour,
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
      clusterClassName: styles.cluster,
      clusterCountClassName: styles.clusterCount,
      describeCluster: (count) =>
        format(texts.cluster, { count, problems: plural(count, texts.clusterForms) }),
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

  // Тема сменилась — сцена перекрашивается на месте, без перестройки и вступления.
  useEffect(() => subscribeTheme(() => sceneRef.current?.refreshTheme()), []);

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
    sceneRef.current.setHeightScale(heightScale);
  }, [heightScale]);

  useEffect(() => {
    sceneRef.current.selectDistrict(selectedSlug ?? null);
  }, [selectedSlug]);

  useEffect(() => {
    sceneRef.current.setSelectedProblem(selectedProblemId);
  }, [selectedProblemId]);

  useEffect(() => {
    if (hour !== undefined) sceneRef.current.setHour(hour);
  }, [hour]);

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
