import { chapterTime, CHAPTERS } from './chapters';
import { addScreenTimeline, SCREEN_TIMING } from './screenTimeline';

// Начало истории на телефонах и планшетах: телефон в руке. Глава 1 — рука поднимает телефон
// ближе, экран блокировки уходит, открываются «Заметки»; глава 2 — идеи, вопрос, карта на экране;
// дальше 3D-город живёт внутри экрана. Полоски сверху экрана показывают, какая глава идёт.
export function addPhoneTimeline(timeline, select) {
  const one = (name) => select(`[data-phone="${name}"]`);

  timeline.fromTo(
    one('device'),
    { yPercent: 6, rotation: -3 },
    { yPercent: 0, rotation: 0, duration: 5, ease: 'power2.out' },
    chapterTime(0),
  );
  timeline.to(
    one('lock'),
    { yPercent: -16, autoAlpha: 0, duration: 1.8, ease: 'power2.in' },
    chapterTime(0, 6),
  );
  timeline.fromTo(
    one('app'),
    { autoAlpha: 0, scale: 0.94 },
    { autoAlpha: 1, scale: 1, duration: 1.4, ease: 'power2.out' },
    chapterTime(0, 7.6),
  );

  addScreenTimeline(timeline, select, SCREEN_TIMING.phone);
  // Карта на экране в рамке первого кадра 3D: растворяется в город на месте.
  timeline.to(one('flat'), { autoAlpha: 0, duration: 0.9, ease: 'power1.inOut' }, chapterTime(2));

  select('[data-phone="progress"]').forEach((bar, i) => {
    timeline.fromTo(
      bar,
      { scaleX: 0 },
      { scaleX: 1, transformOrigin: '0% 50%', duration: chapterTime(1), ease: 'none' },
      chapterTime(i),
    );
  });
  timeline.to({}, { duration: 0.01 }, chapterTime(CHAPTERS.length));
  return timeline;
}
