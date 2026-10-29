import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useViewport } from '@/adaptations/core';
import { useCityData } from '@/features/map';
import { gsap, ScrollTrigger, useGSAP } from '@/shared/animations/core/gsapSetup';
import { useCityOutline } from '@/shared/hooks/useCityOutline';
import { useLanguage } from '@/shared/hooks/useLanguage';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { useTheme } from '@/shared/hooks/useTheme';
import { CHAPTERS, story } from '../lib/chapters';
import { planeMatrix } from '../lib/isometric';
import { addPhoneTimeline } from '../lib/phoneTimeline';
import { COVER, RoomCamera } from '../lib/roomCamera';
import { monitorMapBox, SCREEN } from '../lib/roomLayout';
import { outlineCenter, topViewBox } from '../lib/topView';
import { useBoxSize } from '../hooks/useBoxSize';
import { addRoomTimeline } from '../lib/roomTimeline';
import { addOverlayTimeline } from '../lib/storyTimeline';
import { PhoneStage } from './phone/PhoneStage';
import { IsometricRoom } from './room/IsometricRoom';
import { StoryOverlay } from './StoryOverlay';
import styles from './StoryExperience.module.css';

const CITY = 'kostanay';

// «Как родилась идея»: закреплённая сцена, вся история которой — одна временная шкала, привязанная
// к прокрутке. Начало плоское: на ПК — изометрическая комната (наезд на монитор), на телефонах и
// планшетах — рука достаёт телефон, и история идёт на его экране. С главы «город» — 3D-город
// (StoryScene, грузится отдельно вместе с three.js): на ПК во весь экран, на телефоне — внутри
// экрана телефона. При reduced motion закрепления нет — финальный кадр и история обычным текстом.
// onReady — вызывается, когда сцена готова и данные города на месте: переход между страницами
// держит экран закрытым до этого момента (AboutPage).
export function StoryExperience({ onOpenMap, onReady }) {
  const language = useLanguage();
  // Тема перекрашивает 3D-город (цвета читаются при создании) — сцена создаётся заново.
  const theme = useTheme();
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const flatRef = useRef(null);
  const sceneBoxRef = useRef(null);
  const canvasRef = useRef(null);
  const [scene, setScene] = useState(null);
  const [failed, setFailed] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  // Прокрутка до перестройки шкалы: при перестройке закрепление снимается, страница на миг
  // становится короче, и браузер сбрасывает прокрутку назад.
  const scrollRef = useRef(null);
  const reduced = useReducedMotion();
  const { city, moods, problems } = useCityData(CITY, 'week');
  const outline = useCityOutline(city.data, problems.data);
  const stageSize = useBoxSize(stageRef);
  // Изометрическая комната — на ПК; телефоны и планшеты получают телефон в руке.
  const { isDesktop, portrait } = useViewport();
  const variant = isDesktop ? 'room' : 'phone';
  const orientation = portrait ? 'portrait' : 'landscape';
  const dataReady = Boolean(city.data && moods.data && problems.data);
  const timelineDeps = [scene, failed, dataReady, reduced, language, variant, orientation];

  // 3D-город рисуется по размеру своего блока: вся сцена на ПК, экран телефона — на телефоне.
  // Без WebGL (или если three.js не загрузился) история остаётся плоской: комната и экран телефона
  // работают, глав с городом нет.
  useEffect(() => {
    let alive = true;
    let current = null;
    import('../scene/StoryScene')
      .then(({ StoryScene }) => {
        const box = variant === 'room' ? stageRef.current : sceneBoxRef.current;
        const next = new StoryScene(canvasRef.current, box);
        if (!alive) return next.dispose();
        current = next;
        setScene(next);
        return next.ready.then(() => {
          if (alive) setSceneReady(true);
        });
      })
      .catch((error) => {
        console.error('Story scene failed, the story stays flat', error);
        if (!alive) return;
        setFailed(true);
        setSceneReady(true);
      });
    return () => {
      alive = false;
      current?.dispose();
      setScene(null);
      setFailed(false);
      setSceneReady(false);
    };
  }, [theme, variant]);

  const ready = sceneReady && dataReady;
  useEffect(() => {
    if (ready) onReady?.();
  }, [ready, onReady]);

  // Очистки эффектов идут в порядке объявления: этот запоминает прокрутку раньше, чем useGSAP ниже
  // снимет закрепление.
  useLayoutEffect(
    () => () => {
      scrollRef.current = window.scrollY;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- те же зависимости, что у шкалы
    timelineDeps,
  );

  useGSAP(
    () => {
      if ((!scene && !failed) || !dataReady) return undefined;
      scene?.setCity(city.data, moods.data, problems.data, outlineCenter(outline.viewBox));
      const q = gsap.utils.selector(rootRef);
      const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
      let camera = null;
      if (variant === 'room') {
        const root = flatRef.current;
        camera = new RoomCamera(
          root.querySelector('[data-room="svg"]'),
          root.querySelector('[data-room="camera"]'),
          { matrix: planeMatrix('x', SCREEN.corner, SCREEN.scale), size: SCREEN.size },
          { tilt: reduced ? null : root.querySelector('[data-room="tilt"]') },
        );
        addRoomTimeline(tl, { q, camera });
      } else {
        addPhoneTimeline(tl, q);
      }
      scene?.buildTimeline(tl);
      if (reduced) {
        tl.progress(1);
        return () => camera?.dispose();
      }

      addOverlayTimeline(tl, { q, stage: stageRef.current, variant });

      const trigger = ScrollTrigger.create({
        trigger: stageRef.current,
        start: 'top top',
        end: `+=${CHAPTERS.length * 100}%`,
        pin: true,
        scrub: 0.8,
        animation: tl,
      });
      // Закрепление появляется только после загрузки данных города и добавляет 900 % прокрутки:
      // триггеры ниже по странице (гид) должны пересчитать свои позиции.
      ScrollTrigger.refresh();
      // Перестройка на месте (новые данные, смена языка): тот же кадр истории, без отскока прокрутки.
      if (scrollRef.current !== null) {
        window.scrollTo({ top: scrollRef.current, behavior: 'instant' });
        trigger.update();
        tl.progress(trigger.progress);
      }
      return () => camera?.dispose();
    },
    {
      scope: rootRef,
      // scene: новая сцена (тема, вид устройства); language: фразы, разобранные на слова, и
      // печатаемый вопрос — на новом языке; variant и orientation — другая разметка сцены.
      dependencies: timelineDeps,
      revertOnUpdate: true,
    },
  );

  // При reduced motion история идёт текстом под сценой — оверлей не нужен.
  const overlay = !reduced && (
    <StoryOverlay variant={variant} orientation={orientation} onOpenMap={onOpenMap} />
  );
  return (
    <section
      ref={rootRef}
      className={styles.story}
      data-variant={variant}
      data-static={reduced || undefined}
    >
      <div ref={stageRef} className={styles.stage}>
        {variant === 'room' ? (
          <>
            <canvas
              ref={canvasRef}
              className={styles.canvas}
              data-story="canvas"
              aria-hidden="true"
            />
            <IsometricRoom
              ref={flatRef}
              outline={outline}
              mapBox={
                stageSize &&
                outline &&
                monitorMapBox(
                  topViewBox(stageSize.width, stageSize.height, outlineCenter(outline.viewBox)),
                  stageSize.width,
                  stageSize.height,
                  COVER,
                )
              }
            />
            {overlay}
          </>
        ) : (
          <PhoneStage
            ref={flatRef}
            screenRef={sceneBoxRef}
            canvasRef={canvasRef}
            outline={outline}
            orientation={orientation}
            ready={ready}
            reduced={reduced}
          >
            {overlay}
          </PhoneStage>
        )}
        {/* Завеса до готовности сцены: при прямом входе на страницу (без перехода) картинка не
            появляется по частям. */}
        <div className={styles.veil} data-hidden={ready || undefined} aria-hidden="true" />
      </div>

      {reduced && (
        <ol className={styles.staticStory}>
          <li className={styles.staticItem}>{story.stamp}</li>
          {CHAPTERS.map((chapter) =>
            [chapter.text, chapter.phrase, chapter.question].filter(Boolean).map((line) => (
              <li key={line} className={styles.staticItem}>
                {line}
              </li>
            )),
          )}
        </ol>
      )}
    </section>
  );
}
