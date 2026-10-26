import { SplitText } from '@/shared/animations/gsapSetup';
import { at, CHAPTERS } from './content';

export const LIVING = CHAPTERS.findIndex((c) => c.id === 'living');
export const FINAL = CHAPTERS.length - 1;
const DIPLOMA = CHAPTERS.findIndex((c) => c.id === 'diploma');
const PRODUCT = CHAPTERS.findIndex((c) => c.id === 'product');
const MOOD = CHAPTERS.findIndex((c) => c.id === 'mood');
const PANEL_OFFSET = { left: [-80, 0], right: [80, 0], top: [0, -60], bottom: [0, 60] };

// Анимации поверх сцены (подписи, карточка настроения, крупные фразы, календарь, панели интерфейса,
// финал) — общие для 3D-сцены и лёгкой графики. q — селектор внутри блока истории, stage —
// закреплённая сцена (её нижний край растворяется в конце).
export function addOverlayTimeline(tl, { q, stage }) {
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
  tl.to(stage, { '--stage-fade': '35%', duration: 2.5 }, at(FINAL, 7.5));
  tl.to({}, { duration: 0.01 }, at(CHAPTERS.length));
}
