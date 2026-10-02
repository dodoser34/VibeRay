import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useCityData } from '@/features/map';
import { gsap, ScrollTrigger, SplitText, useGSAP } from '@/shared/animations/gsapSetup';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { Button } from '@/shared/ui/Button';
import { useTheme } from '@/shared/hooks/useTheme';
import { CHAPTER, CHAPTERS, isDaylight, story } from '../content';
import { StoryScene } from '../scene/StoryScene';
import { StoryCalendar } from './StoryCalendar';
import { StoryInterface } from './StoryInterface';
import { StoryMoodCard } from './StoryMoodCard';
import about from '@/texts/ru/about.json';
import { useLanguage } from '@/shared/hooks/useLanguage';
import styles from './StoryExperience.module.css';

const CITY = 'kostanay';
const at = (chapter, offset = 0) => chapter * CHAPTER + offset;
const PANEL_OFFSET = { left: [-80, 0], right: [80, 0], top: [0, -60], bottom: [0, 60] };
const LIVING = CHAPTERS.findIndex((c) => c.id === 'living');
const DIPLOMA = CHAPTERS.findIndex((c) => c.id === 'diploma');
const PRODUCT = CHAPTERS.findIndex((c) => c.id === 'product');
const MOOD = CHAPTERS.findIndex((c) => c.id === 'mood');
const FINAL = CHAPTERS.length - 1;

// «Как родилась идея»: закреплённая 3D-сцена, вся история которой — одна временная шкала,
// привязанная к прокрутке. При reduced motion закрепления нет — финальный кадр и история обычным
// текстом.
// onReady — вызывается один раз, когда комната загружена и данные города на месте: переход между
// страницами держит экран закрытым до этого момента (AboutPage).
export function StoryExperience({ onOpenMap, onReady }) {
  const language = useLanguage();
  // Тема выбирает вариант истории: ночь в тёмной, день в светлой (content.js, RoomSet).
  const theme = useTheme();
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const [sceneReady, setSceneReady] = useState(false);
  // Прокрутка до перестройки шкалы: при перестройке закрепление снимается, страница на миг
  // становится короче, и браузер сбрасывает прокрутку назад.
  const scrollRef = useRef(null);
  const reduced = useReducedMotion();
  const { city, moods, problems } = useCityData(CITY, 'week');
  const timelineDeps = [city.data, moods.data, problems.data, reduced, language, theme];

  // Layout-эффект: сцена должна существовать до того, как useGSAP (тоже layout-эффект) построит
  // шкалу.
  useLayoutEffect(() => {
    // Смена темы пересобирает сцену в другом варианте комнаты, шкала строится заново (theme в
    // timelineDeps) — кадр истории сохраняется.
    const scene = new StoryScene(canvasRef.current, stageRef.current, { daylight: isDaylight() });
    sceneRef.current = scene;
    let alive = true;
    scene.ready.then(() => alive && setSceneReady(true));
    return () => {
      alive = false;
      scene.dispose();
      sceneRef.current = null;
    };
  }, [theme]);

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
      const scene = sceneRef.current;
      if (!scene || !city.data || !moods.data || !problems.data) return;
      scene.setCity(city.data, moods.data, problems.data);
      const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
      scene.buildTimeline(tl);
      if (reduced) {
        tl.progress(1);
        return;
      }

      const q = gsap.utils.selector(rootRef);
      const one = (name) => q(`[data-story="${name}"]`);
      const show = (targets, time, vars = {}) =>
        tl.fromTo(
          targets,
          { autoAlpha: 0, y: 24 },
          { autoAlpha: 1, y: 0, duration: 1.2, ease: 'power2.out', ...vars },
          time,
        );
      const hide = (targets, time) =>
        tl.to(targets, { autoAlpha: 0, y: -16, duration: 1, ease: 'power2.in' }, time);
      // Крупные фразы поднимаются по словам из-под маски (разбиение откатывается вместе с
      // контекстом).
      const words = (target, time) => {
        const split = SplitText.create(target, { type: 'words', mask: 'words' });
        tl.set(target, { autoAlpha: 1 }, time);
        tl.from(
          split.words,
          { yPercent: 110, autoAlpha: 0, duration: 1.1, stagger: 0.14, ease: 'power3.out' },
          time,
        );
      };

      hide(one('hint'), 0.2);
      hide(one('stamp'), at(0, 8.5));
      q('[data-story="caption"]').forEach((caption) => {
        const i = Number(caption.dataset.index);
        if (i > 0) show(caption, at(i, 1));
        hide(caption, at(i, 8.5));
      });

      // В экран: монитор показывает ту же карту, с которой открывается город, поэтому короткого
      // моргания хватает, чтобы скрыть прыжок из комнаты в 3D-город (монтаж по совпадению).
      tl.fromTo(one('fade'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.7 }, at(1, 9.2));
      tl.to(one('fade'), { autoAlpha: 0, duration: 0.9 }, at(2, 0.05));

      show(one('mood-card'), at(MOOD, 0.5));
      tl.fromTo(
        one('mood-pick'),
        { autoAlpha: 0, scale: 0.7 },
        { autoAlpha: 1, scale: 1, duration: 0.6, ease: 'back.out(2)' },
        at(MOOD, 2.5),
      );
      hide(one('mood-card'), at(MOOD, 8.5));

      // Крупные фразы: карта отходит назад, чтобы слова читались чисто. Сначала на полной яркости
      // рисуются дуги между районами, затем фраза берёт своё.
      tl.to(one('canvas'), { opacity: 0.5, duration: 1.2 }, at(LIVING, 3));
      words(one('phrase-living'), at(LIVING, 3.4));
      hide(one('phrase-living'), at(LIVING, 8.5));
      tl.to(one('canvas'), { opacity: 1, duration: 1 }, at(LIVING, 9));

      // 4-й год: карта темнеет, листы календаря перелистываются.
      tl.to(one('canvas'), { opacity: 0.25, duration: 1 }, at(DIPLOMA));
      const sheets = q('[data-story="sheet"]');
      // Все месяцы помещаются между 1 и 8.5 главы; последний остаётся до 9.
      const step = Math.min(1.5, 7.5 / sheets.length);
      sheets.forEach((sheet, k) => {
        tl.fromTo(
          sheet,
          { autoAlpha: 0, rotateX: -80 },
          { autoAlpha: 1, rotateX: 0, duration: step * 0.6, ease: 'power2.out' },
          at(DIPLOMA, 1 + k * step),
        );
        const leave = k < sheets.length - 1 ? at(DIPLOMA, 1 + (k + 1) * step) : at(DIPLOMA, 9);
        tl.to(sheet, { autoAlpha: 0, rotateX: 80, duration: step * 0.5, ease: 'power2.in' }, leave);
      });
      tl.to(one('canvas'), { opacity: 1, duration: 1 }, at(DIPLOMA, 9));

      q('[data-story="panel"]').forEach((panel, k) => {
        const [x, y] = PANEL_OFFSET[panel.dataset.from];
        tl.fromTo(
          panel,
          { autoAlpha: 0, x, y },
          { autoAlpha: 1, x: 0, y: 0, duration: 1.4, ease: 'power3.out' },
          at(PRODUCT, 1 + k * 0.8),
        );
      });
      hide(q('[data-story="panel"]'), at(PRODUCT, 8.8));

      tl.to(one('canvas'), { opacity: 0.4, duration: 1.2 }, at(FINAL, 0.6));
      words(one('final-phrase'), at(FINAL, 1));
      show(one('final-question'), at(FINAL, 3.5), { duration: 1.6 });
      show(one('cta'), at(FINAL, 5.5));
      // Мягкий нижний край перед тем, как закрепление отпустит (см. .stage в CSS).
      tl.to(stageRef.current, { '--stage-fade': '35%', duration: 2.5 }, at(FINAL, 7.5));
      tl.to({}, { duration: 0.01 }, at(CHAPTERS.length));

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
      // language: фразы, разобранные на слова, пересоздаются на новом языке; theme: новая сцена —
      // шкалу строим заново.
      dependencies: timelineDeps,
      revertOnUpdate: true,
    },
  );

  const living = CHAPTERS[LIVING];
  const final = CHAPTERS[FINAL];
  return (
    <section ref={rootRef} className={styles.story} data-static={reduced || undefined}>
      <div ref={stageRef} className={styles.stage}>
        <canvas ref={canvasRef} className={styles.canvas} data-story="canvas" aria-hidden="true" />

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
