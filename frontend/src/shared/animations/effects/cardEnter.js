// Первое появление карточки: она выдвигается снизу из размытия и проявляется, её части (data-part)
// поднимаются следом с небольшим шагом. Общая для карточки входа и QR-карточки главной — чтобы они
// появлялись одинаково. Добавляет шаги в timeline с момента at.
export function cardEnter(timeline, card, parts, at = 0) {
  timeline.from(
    card,
    {
      y: 40,
      scale: 0.98,
      filter: 'blur(6px)',
      autoAlpha: 0,
      transformOrigin: '50% 100%',
      duration: 1.4,
      ease: 'power2.out',
      clearProps: 'transform,filter',
    },
    at,
  );
  return partsEnter(timeline, parts, '<0.45');
}

// Части карточки поднимаются и проявляются по очереди (и при смене формы внутри карточки входа).
export function partsEnter(timeline, parts, at) {
  return timeline.from(
    parts,
    { y: 14, autoAlpha: 0, duration: 0.9, ease: 'power2.out', stagger: 0.07 },
    at,
  );
}
