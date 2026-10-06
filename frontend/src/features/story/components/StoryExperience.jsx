import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { fallBackToLite, useLiteGraphics, useViewport } from '@/adaptations/core';
import { useCityData } from '@/features/map';
import { gsap, ScrollTrigger, useGSAP } from '@/shared/animations/gsapSetup';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { Button } from '@/shared/ui/controls/Button';
import { useTheme } from '@/shared/hooks/useTheme';
import { CHAPTERS, isDaylight, story } from '../content';
import { LiteStage } from '../scene/LiteStage';
import { addOverlayTimeline, FINAL, LIVING } from '../storyTimeline';
import { StoryIllustration } from './StoryIllustration';
import { StoryCalendar } from './StoryCalendar';
import { StoryInterface } from './StoryInterface';
import { StoryMoodCard } from './StoryMoodCard';
import about from '@/texts/ru/about.json';
import { useLanguage } from '@/shared/hooks/useLanguage';
import styles from './StoryExperience.module.css';

const CITY = 'kostanay';
// Не дождались 3D-комнату за это время — показываем лёгкую графику (медленная сеть, слабое устройство).
const LOAD_LIMIT = 12000;

// «Как родилась идея»: закреплённая сцена, вся история которой — одна временная шкала, привязанная
// к прокрутке. Сцена — 3D-комната (StoryScene, грузится отдельно вместе с three.js) или, в лёгком
// режиме графики, плоская иллюстрация (LiteStage + StoryIllustration) с тем же интерфейсом. При
// reduced motion закрепления нет — финальный кадр и история обычным текстом.
// onReady — вызывается, когда сцена готова и данные города на месте: переход между страницами
// держит экран закрытым до этого момента (AboutPage).
export function StoryExperience({ onOpenMap, onReady }) {
  const language = useLanguage();
  // Тема выбирает вариант истории: ночь в тёмной, день в светлой (content.js, RoomSet).
  const theme = useTheme();
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const illustrationRef = useRef(null);
  const lite = useLiteGraphics();
  const [scene, setScene] = useState(null);
  const [sceneReady, setSceneReady] = useState(false);
  // Прокрутка до перестройки шкалы: при перестройке закрепление снимается, страница на миг
  // становится короче, и браузер сбрасывает прокрутку назад.
  const scrollRef = useRef(null);
  const reduced = useReducedMotion();
  const { city, moods, problems } = useCityData(CITY, 'week');
  // Зум плоской комнаты рассчитан под пропорции экрана (LiteStage): при повороте или смене уровня
  // устройства шкала строится заново. 3D-камера подстраивается под экран сама.
  const { tier, portrait } = useViewport();
  const frame = lite ? `${tier}|${portrait}` : null;
  const timelineDeps = [scene, city.data, moods.data, problems.data, reduced, language, frame];

  // Тема выбирает вариант 3D-комнаты (день или ночь) — сцена создаётся заново, шкала тоже (scene в
  // timelineDeps), кадр истории сохраняется. 3D-сцена приходит асинхронно, лёгкая — сразу.
  useEffect(() => {
    let alive = true;
    let current = null;
    let timer = null;
    const create = lite
      ? Promise.resolve(new LiteStage(illustrationRef.current))
      : import('../scene/StoryScene').then(
          ({ StoryScene }) =>
            new StoryScene(canvasRef.current, stageRef.current, { daylight: isDaylight() }),
        );
    create
      .then((next) => {
        if (!alive) return next.dispose();
        current = next;
        setScene(next);
        if (!lite) timer = setTimeout(fallBackToLite, LOAD_LIMIT);
        return next.ready.then(() => {
          clearTimeout(timer);
          if (alive) setSceneReady(true);
        });
      })
      .catch((error) => {
        console.error('Story scene failed, switching to light graphics', error);
        fallBackToLite();
      });
    return () => {
      alive = false;
      clearTimeout(timer);
      current?.dispose();
      setScene(null);
      setSceneReady(false);
    };
  }, [lite, theme]);

  const ready = sceneReady && Boolean(city.data && moods.data && problems.data);
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
      if (!scene || !city.data || !moods.data || !problems.data) return;
      scene.setCity(city.data, moods.data, problems.data);
      const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
      scene.buildTimeline(tl);
      if (reduced) {
        tl.progress(1);
        return;
      }

      addOverlayTimeline(tl, { q: gsap.utils.selector(rootRef), stage: stageRef.current });

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
    },
    {
      scope: rootRef,
      // scene: новая сцена (тема, режим графики); language: фразы, разобранные на слова,
      // пересоздаются на новом языке; frame: другой кадр плоской комнаты — шкалу строим заново.
      dependencies: timelineDeps,
      revertOnUpdate: true,
    },
  );

  const living = CHAPTERS[LIVING];
  const final = CHAPTERS[FINAL];
  return (
    <section ref={rootRef} className={styles.story} data-static={reduced || undefined}>
      <div ref={stageRef} className={styles.stage}>
        {lite ? (
          <StoryIllustration
            ref={illustrationRef}
            city={city.data}
            moods={moods.data}
            problems={problems.data}
          />
        ) : (
          <canvas
            ref={canvasRef}
            className={styles.canvas}
            data-story="canvas"
            aria-hidden="true"
          />
        )}

        <div className={styles.overlay}>
          <p className={styles.stamp} data-story="stamp" data-ui="story-stamp">
            {story.stamp}
          </p>
          {CHAPTERS.map(
            (chapter, i) =>
              chapter.text && (
                <p
                  key={chapter.id}
                  className={styles.caption}
                  data-ui="story-caption"
                  data-story="caption"
                  data-index={i}
                  data-later={i > 0 || undefined}
                >
                  {chapter.text}
                </p>
              ),
          )}
          <div className={styles.center}>
            <p key={language} className={styles.phrase} data-story="phrase-living" data-later>
              {living.phrase}
            </p>
          </div>
          <div className={styles.moodSlot} data-ui="story-mood-slot">
            <StoryMoodCard />
          </div>
          <div className={styles.center}>
            <StoryCalendar />
          </div>
          <StoryInterface />
          <div className={`${styles.center} ${styles.finale}`}>
            <p key={language} className={styles.phrase} data-story="final-phrase" data-later>
              {final.phrase}
            </p>
            <p className={styles.question} data-story="final-question" data-later>
              {final.question}
            </p>
            <div className={styles.cta} data-story="cta" data-later>
              <Button size="lg" onClick={onOpenMap}>
                {about.story.openMap}
              </Button>
            </div>
          </div>
          <p className={styles.hint} data-story="hint">
            {about.story.hint}
          </p>
        </div>
        <div className={styles.fade} data-story="fade" aria-hidden="true" />
        {/* Завеса до готовности комнаты: при прямом входе на страницу (без перехода) модель не
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
