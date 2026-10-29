import { SplitText } from '@/shared/animations/core/gsapSetup';
import { at, CHAPTERS } from './chapters';

export const LIVING = CHAPTERS.findIndex((c) => c.id === 'living');
export const FINAL = CHAPTERS.length - 1;
const BUILD = CHAPTERS.findIndex((c) => c.id === 'build');
const PRODUCT = CHAPTERS.findIndex((c) => c.id === 'product');
const MOOD = CHAPTERS.findIndex((c) => c.id === 'mood');
// Глава с «Заметками» на экране (идеи и вопрос).
const NOTES = CHAPTERS.findIndex((c) => c.id === 'search');
const PANEL_OFFSET = { left: [-80, 0], right: [80, 0], top: [0, -60], bottom: [0, 60] };

// Анимации поверх сцены (подписи, карточка настроения, крупные фразы, план проекта, панели
// интерфейса, финал). q — селектор внутри блока истории, stage — закреплённая сцена (её нижний край
// растворяется в конце). variant — как история разворачивается:
//   'room'  — ПК: подписи всплывают в углу, карточка и панели выезжают к краям большого экрана;
//   'phone' — телефон в руке, как в приложении: подписи приходят уведомлениями внизу экрана,
//             карточка настроения — шторка снизу, панели интерфейса въезжают экранами справа.
export function addOverlayTimeline(tl, { q, stage, variant = 'room' }) {
  const phone = variant === 'phone';
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
  // Когда подпись уходит на телефоне: на экране блокировки — до разблокировки, в «Заметках» — до
  // списка идей, в главах «настроение», «начал делать» и «продукт» — до шторки, плана и панелей, иначе — в конце главы.
  const captionLeave = (i) => {
    if (i === 0) return at(0, 5.2);
    if (i === NOTES) return at(NOTES, 3);
    if (i === MOOD) return at(MOOD, 3.2);
    if (i === BUILD) return at(BUILD, 3);
    if (i === PRODUCT) return at(PRODUCT, 2.8);
    return at(i, 8.5);
  };
  q('[data-story="caption"]').forEach((caption) => {
    const i = Number(caption.dataset.index);
    if (phone) {
      // Уведомление внизу экрана: въезжает снизу и уезжает вниз. Когда уходить — captionLeave.
      const away = 130;
      if (i > 0) {
        tl.fromTo(
          caption,
          { autoAlpha: 0, yPercent: away },
          { autoAlpha: 1, yPercent: 0, duration: 1, ease: 'back.out(1.4)' },
          at(i, i === NOTES ? 0.3 : 1),
        );
      }
      tl.to(
        caption,
        { autoAlpha: 0, yPercent: away, duration: 0.9, ease: 'power2.in' },
        captionLeave(i),
      );
      return;
    }
    if (i > 0) show(caption, at(i, 1));
    hide(caption, at(i, 8.5));
  });

  if (phone) {
    // Шторка снизу экрана: выезжает, жилец выбирает настроение, шторка уезжает вниз.
    // Сначала читается уведомление главы, потом выезжает шторка.
    tl.fromTo(
      one('mood-card'),
      { autoAlpha: 0, yPercent: 120 },
      { autoAlpha: 1, yPercent: 0, duration: 1.3, ease: 'power3.out' },
      at(MOOD, 4),
    );
    tl.to(one('mood-card'), { yPercent: 120, duration: 1, ease: 'power2.in' }, at(MOOD, 8.5));
    tl.set(one('mood-card'), { autoAlpha: 0 }, at(MOOD, 9.5));
  } else {
    show(one('mood-card'), at(MOOD, 0.5));
    hide(one('mood-card'), at(MOOD, 8.5));
  }
  tl.fromTo(
    one('mood-pick'),
    { autoAlpha: 0, scale: 0.7 },
    { autoAlpha: 1, scale: 1, duration: 0.6, ease: 'back.out(2)' },
    at(MOOD, phone ? 5.6 : 2.5),
  );

  // Крупные фразы: карта отходит назад, чтобы слова читались чисто. Сначала на полной яркости
  // рисуются дуги между районами, затем фраза берёт своё.
  tl.to(one('canvas'), { opacity: phone ? 0.35 : 0.5, duration: 1.2 }, at(LIVING, 3));
  words(one('phrase-living'), at(LIVING, 3.4));
  hide(one('phrase-living'), at(LIVING, 8.5));
  tl.to(one('canvas'), { opacity: 1, duration: 1 }, at(LIVING, 9));

  // Начал делать во время учёбы: карта отходит назад, появляется план проекта, пункты отмечаются по
  // очереди, полоса прогресса растёт вместе с ними. На телефоне план — после того, как ушла подпись.
  tl.to(one('canvas'), { opacity: 0.3, duration: 1 }, at(BUILD));
  show(one('build-card'), at(BUILD, phone ? 3.6 : 1.2));
  const checks = q('[data-story="build-check"]');
  const [first, gap] = phone ? [4.8, 0.65] : [2.4, 1];
  checks.forEach((check, k) => {
    tl.fromTo(
      check,
      { autoAlpha: 0, scale: 0.4 },
      { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' },
      at(BUILD, first + k * gap),
    );
  });
  tl.fromTo(
    one('build-bar'),
    { scaleX: 0 },
    { scaleX: 1, duration: checks.length * gap, ease: 'none' },
    at(BUILD, first),
  );
  hide(one('build-card'), at(BUILD, 8.5));
  tl.to(one('canvas'), { opacity: 1, duration: 1 }, at(BUILD, 9));

  q('[data-story="panel"]').forEach((panel, k) => {
    const [x, y] = phone ? [0, 0] : PANEL_OFFSET[panel.dataset.from];
    tl.fromTo(
      panel,
      phone ? { autoAlpha: 0, xPercent: 110 } : { autoAlpha: 0, x, y },
      { autoAlpha: 1, x: 0, y: 0, xPercent: 0, duration: 1.4, ease: 'power3.out' },
      phone ? at(PRODUCT, 3.8 + k * 0.6) : at(PRODUCT, 1 + k * 0.8),
    );
  });
  if (phone) {
    tl.to(
      q('[data-story="panel"]'),
      { autoAlpha: 0, xPercent: -110, duration: 1, ease: 'power2.in' },
      at(PRODUCT, 8.8),
    );
  } else {
    hide(q('[data-story="panel"]'), at(PRODUCT, 8.8));
  }

  tl.to(one('canvas'), { opacity: phone ? 0.3 : 0.4, duration: 1.2 }, at(FINAL, 0.6));
  words(one('final-phrase'), at(FINAL, 1));
  show(one('final-question'), at(FINAL, 3.5), { duration: 1.6 });
  show(one('cta'), at(FINAL, 5.5));
  // Мягкий нижний край перед тем, как закрепление отпустит (см. .stage в CSS). Телефон в руке
  // не растворяется — он целиком остаётся в кадре.
  if (!phone) tl.to(stage, { '--stage-fade': '35%', duration: 2.5 }, at(FINAL, 7.5));
  tl.to({}, { duration: 0.01 }, at(CHAPTERS.length));
}
