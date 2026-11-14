// Первое появление карточки: она выдвигается снизу и проявляется, её части (data-part) поднимаются
// следом с небольшим шагом. Общая для карточки входа и QR-карточки главной — чтобы они появлялись
// одинаково. Добавляет шаги в timeline с момента at. Только transform и opacity: размытие (filter)
// перерисовывало бы всю карточку с полями в каждом кадре, и на фоне 3D-сцены появление подлагивало.
export function cardEnter(timeline, card, parts, at = 0) {
  timeline.fromTo(
    card,
    { y: 40, scale: 0.98, autoAlpha: 0 },
    {
      y: 0,
      scale: 1,
      autoAlpha: 1,
      transformOrigin: '50% 100%',
      duration: 1.2,
      ease: 'power3.out',
      clearProps: 'transform',
    },
    at,
  );
  return partsEnter(timeline, parts, '<0.35');
}

// Части карточки поднимаются и проявляются по очереди (и при смене формы внутри карточки входа).
export function partsEnter(timeline, parts, at) {
  return timeline.from(
    parts,
    { y: 14, autoAlpha: 0, duration: 0.8, ease: 'power3.out', stagger: 0.06 },
    at,
  );
}
