import { at } from './chapters';
import { addScreenTimeline } from './screenTimeline';

// Начало истории на ПК: изометрическая комната. Глава 1 — наезд на монитор (комната ещё видна);
// глава 2 — экран крупно: идеи, вопрос, карта; камера разворачивается к экрану анфас и «входит» в
// него, а карта на экране растворяется в 3D-город на том же месте.
export function addRoomTimeline(tl, { q, camera }) {
  const view = { t: 0 };
  const move = () => camera.set(view.t);
  move();
  tl.to(view, { t: 0.5, duration: 9, ease: 'power2.inOut', onUpdate: move }, at(0));
  tl.to(view, { t: 0.8, duration: 4.5, ease: 'power1.inOut', onUpdate: move }, at(1));
  tl.to(view, { t: 1, duration: 2.2, ease: 'power2.in', onUpdate: move }, at(1, 7.2));

  addScreenTimeline(tl, q);
  // Карта на мониторе — в рамке первого кадра города: комната растворяется, город — на месте.
  tl.to(q('[data-room="root"]'), { autoAlpha: 0, duration: 0.9, ease: 'power1.inOut' }, at(2));
  return tl;
}
