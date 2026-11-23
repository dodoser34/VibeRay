import { SplitText } from '@/shared/animations/core/gsapSetup';
import { format } from '@/shared/lib/i18n/format';
import about from '@/texts/en/about.json';
import { chapterTime, CHAPTERS } from './chapters';
import { WORD_MASK } from '@/shared/animations/effects/wordMask';

export const LIVING = CHAPTERS.findIndex((chapter) => chapter.id === 'living');
export const FINAL = CHAPTERS.length - 1;
export const BUILD = CHAPTERS.findIndex((chapter) => chapter.id === 'build');
export const PRODUCT = CHAPTERS.findIndex((chapter) => chapter.id === 'product');
export const MOOD = CHAPTERS.findIndex((chapter) => chapter.id === 'mood');
// Глава с «Заметками» на экране (идеи и вопрос).
const NOTES = CHAPTERS.findIndex((chapter) => chapter.id === 'search');

// Анимации поверх сцены (подписи, карточка настроения, крупные фразы, план проекта, панели
// интерфейса, финал). q — селектор внутри блока истории, stage — закреплённая сцена (её нижний край
// растворяется в конце). variant — как история разворачивается:
//   'room'  — ПК: подписи всплывают в углу, карточка и панели выезжают к краям большого экрана;
//   'phone' — телефон в руке, как в приложении: подписи приходят уведомлениями внизу экрана,
//             карточка настроения — шторка снизу, панели интерфейса въезжают экранами справа.
export function addOverlayTimeline(timeline, { select, stage, variant = 'room' }) {
  const phone = variant === 'phone';
  const one = (name) => select(`[data-story="${name}"]`);
  const show = (targets, time, vars = {}) =>
    timeline.fromTo(
      targets,
      { autoAlpha: 0, y: 24 },
      { autoAlpha: 1, y: 0, duration: 1.2, ease: 'power2.out', ...vars },
      time,
    );
  const hide = (targets, time) =>
    timeline.to(targets, { autoAlpha: 0, y: -16, duration: 1, ease: 'power2.in' }, time);
  // Крупные фразы поднимаются по словам из-под маски (разбиение откатывается вместе с
  // контекстом).
  const words = (target, time) => {
    const split = SplitText.create(target, WORD_MASK);
    timeline.set(target, { autoAlpha: 1 }, time);
    timeline.from(
      split.words,
      { yPercent: 110, autoAlpha: 0, duration: 1.1, stagger: 0.14, ease: 'power3.out' },
      time,
    );
  };

  hide(one('hint'), 0.2);
  hide(one('stamp'), chapterTime(0, 8.5));
  // Когда подпись уходит на телефоне: на экране блокировки — до разблокировки, в «Заметках» — до
  // списка идей, в главах «настроение», «начал делать» и «продукт» — до шторки, плана и панелей, иначе — в конце главы.
  const captionLeave = (i) => {
    if (i === 0) return chapterTime(0, 5.2);
    if (i === NOTES) return chapterTime(NOTES, 3);
    if (i === MOOD) return chapterTime(MOOD, 3.2);
    if (i === BUILD) return chapterTime(BUILD, 3);
    if (i === PRODUCT) return chapterTime(PRODUCT, 2.8);
    return chapterTime(i, 8.5);
  };
  select('[data-story="caption"]').forEach((caption) => {
    const i = Number(caption.dataset.index);
    if (phone) {
      // Уведомление внизу экрана: въезжает снизу и уезжает вниз. Когда уходить — captionLeave.
      const away = 130;
      if (i > 0) {
        timeline.fromTo(
          caption,
          { autoAlpha: 0, yPercent: away },
          { autoAlpha: 1, yPercent: 0, duration: 1, ease: 'back.out(1.4)' },
          chapterTime(i, i === NOTES ? 0.3 : 1),
        );
      }
      timeline.to(
        caption,
        { autoAlpha: 0, yPercent: away, duration: 0.9, ease: 'power2.in' },
        captionLeave(i),
      );
      return;
    }
    if (i > 0) show(caption, chapterTime(i, 1));
    hide(caption, chapterTime(i, 8.5));
  });

  if (phone) {
    // Шторка снизу экрана: выезжает, жилец выбирает настроение, шторка уезжает вниз.
    // Сначала читается уведомление главы, потом выезжает шторка.
    timeline.fromTo(
      one('mood-card'),
      { autoAlpha: 0, yPercent: 120 },
      { autoAlpha: 1, yPercent: 0, duration: 1.3, ease: 'power3.out' },
      chapterTime(MOOD, 4),
    );
    timeline.to(
      one('mood-card'),
      { yPercent: 120, duration: 1, ease: 'power2.in' },
      chapterTime(MOOD, 8.5),
    );
    timeline.set(one('mood-card'), { autoAlpha: 0 }, chapterTime(MOOD, 9.5));
  } else {
    show(one('mood-card'), chapterTime(MOOD, 0.5));
    hide(one('mood-card'), chapterTime(MOOD, 8.5));
  }
  timeline.fromTo(
    one('mood-pick'),
    { autoAlpha: 0, scale: 0.7 },
    { autoAlpha: 1, scale: 1, duration: 0.6, ease: 'back.out(2)' },
    chapterTime(MOOD, phone ? 5.6 : 2.5),
  );

  // Крупные фразы: карта отходит назад, чтобы слова читались чисто. Сначала на полной яркости
  // рисуются дуги между районами, затем фраза берёт своё.
  timeline.to(
    one('canvas'),
    { opacity: phone ? 0.35 : 0.5, duration: 1.2 },
    chapterTime(LIVING, 3),
  );
  words(one('phrase-living'), chapterTime(LIVING, 3.4));
  hide(one('phrase-living'), chapterTime(LIVING, 8.5));
  timeline.to(one('canvas'), { opacity: 1, duration: 1 }, chapterTime(LIVING, 9));

  // Начал делать во время учёбы: появляется план проекта, пункты отмечаются по очереди, полоса
  // прогресса и счётчик растут вместе с ними. На ПК план стоит в колонке рядом с городом; на телефоне
  // он поверх карты — карта отходит назад, а план появляется после того, как ушла подпись.
  if (phone) timeline.to(one('canvas'), { opacity: 0.3, duration: 1 }, chapterTime(BUILD));
  show(one('build-card'), chapterTime(BUILD, phone ? 3.6 : 1.2));
  const checks = select('[data-story="build-check"]');
  const [first, gap] = phone ? [4.8, 0.55] : [2.4, 1];
  checks.forEach((check, k) => {
    timeline.fromTo(
      check,
      { autoAlpha: 0, scale: 0.4 },
      { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' },
      chapterTime(BUILD, first + k * gap),
    );
  });
  timeline.fromTo(
    one('build-bar'),
    { scaleX: 0 },
    { scaleX: 1, duration: checks.length * gap, ease: 'none' },
    chapterTime(BUILD, first),
  );
  // «4 из 6 готово»: счётчик идёт в такт галочкам — следующее число, как только появилась галочка.
  // Шаг счётчика = шаг галочек, и начинается он на шаг раньше: целая часть совпадает с их числом.
  const counter = one('build-count')[0];
  const progress = { done: 0 };
  const writeCount = () => {
    counter.textContent = format(about.story.build.count, {
      done: Math.min(checks.length, Math.floor(progress.done)),
      total: checks.length,
    });
  };
  writeCount();
  timeline.to(
    progress,
    { done: checks.length, duration: checks.length * gap, onUpdate: writeCount },
    chapterTime(BUILD, first + 0.2 - gap),
  );
  hide(one('build-card'), chapterTime(BUILD, 8.5));
  if (phone) timeline.to(one('canvas'), { opacity: 1, duration: 1 }, chapterTime(BUILD, 9));

  // Панели продукта: на ПК — по очереди въезжают справа в колонку рядом с городом, на телефоне —
  // экранами приложения. График недели следом раскрывается слева направо (маска графика).
  select('[data-story="panel"]').forEach((panel, k) => {
    timeline.fromTo(
      panel,
      phone ? { autoAlpha: 0, xPercent: 110 } : { autoAlpha: 0, x: 60 },
      { autoAlpha: 1, x: 0, xPercent: 0, duration: 1.4, ease: 'power3.out' },
      phone ? chapterTime(PRODUCT, 3.8 + k * 0.6) : chapterTime(PRODUCT, 1 + k * 0.7),
    );
  });
  timeline.fromTo(
    one('stats-reveal'),
    { scaleX: 0, svgOrigin: '0 0' },
    { scaleX: 1, svgOrigin: '0 0', duration: 2, ease: 'power1.inOut' },
    chapterTime(PRODUCT, phone ? 5 : 3.6),
  );
  if (phone) {
    timeline.to(
      select('[data-story="panel"]'),
      { autoAlpha: 0, xPercent: -110, duration: 1, ease: 'power2.in' },
      chapterTime(PRODUCT, 8.8),
    );
  } else {
    hide(select('[data-story="panel"]'), chapterTime(PRODUCT, 8.8));
  }

  timeline.to(
    one('canvas'),
    { opacity: phone ? 0.3 : 0.4, duration: 1.2 },
    chapterTime(FINAL, 0.6),
  );
  words(one('final-phrase'), chapterTime(FINAL, 1));
  show(one('final-question'), chapterTime(FINAL, 3.5), { duration: 1.6 });
  show(one('cta'), chapterTime(FINAL, 5.5));
  // Мягкий нижний край перед тем, как закрепление отпустит (см. .stage в CSS). Телефон в руке
  // не растворяется — он целиком остаётся в кадре.
  if (!phone) timeline.to(stage, { '--stage-fade': '35%', duration: 2.5 }, chapterTime(FINAL, 7.5));
  timeline.to({}, { duration: 0.01 }, chapterTime(CHAPTERS.length));
}
