import { at, CHAPTERS } from './chapters';
import { addScreenTimeline, SCREEN_TIMING } from './screenTimeline';

// Начало истории на телефонах и планшетах: телефон в руке. Глава 1 — рука поднимает телефон
// ближе, экран блокировки уходит, открываются «Заметки»; глава 2 — идеи, вопрос, карта на экране;
// дальше 3D-город живёт внутри экрана. Полоски сверху экрана показывают, какая глава идёт.
export function addPhoneTimeline(tl, q) {
  const one = (name) => q(`[data-phone="${name}"]`);

  tl.fromTo(
    one('device'),
    { yPercent: 6, rotation: -3 },
    { yPercent: 0, rotation: 0, duration: 5, ease: 'power2.out' },
    at(0),
  );
  tl.to(one('lock'), { yPercent: -16, autoAlpha: 0, duration: 1.8, ease: 'power2.in' }, at(0, 6));
  tl.fromTo(
    one('app'),
    { autoAlpha: 0, scale: 0.94 },
    { autoAlpha: 1, scale: 1, duration: 1.4, ease: 'power2.out' },
    at(0, 7.6),
  );

  addScreenTimeline(tl, q, SCREEN_TIMING.phone);
  // Карта на экране в рамке первого кадра 3D: растворяется в город на месте.
  tl.to(one('flat'), { autoAlpha: 0, duration: 0.9, ease: 'power1.inOut' }, at(2));

  q('[data-phone="progress"]').forEach((bar, i) => {
    tl.fromTo(
      bar,
      { scaleX: 0 },
      { scaleX: 1, transformOrigin: '0% 50%', duration: at(1), ease: 'none' },
      at(i),
    );
  });
  tl.to({}, { duration: 0.01 }, at(CHAPTERS.length));
  return tl;
}
