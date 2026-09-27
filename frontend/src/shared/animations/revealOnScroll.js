import { gsap } from './gsapSetup';

// Блоки поднимаются при попадании в зону видимости. Видимость даёт IntersectionObserver, который
// браузер проверяет вживую: ScrollTrigger рассчитывает позиции заранее, и после изменения высоты
// страницы блок в самом конце (футер) мог оказаться ниже последней позиции прокрутки и никогда не
// появиться. Не зависит от размера окна: блок поднимается, когда на экране его доля `share`.
// Вызывать внутри useGSAP и передавать его contextSafe, чтобы анимации откатывались вместе с
// контекстом; возвращает функцию очистки.
export function revealOnScroll(
  elements,
  { contextSafe = (fn) => fn, y = 40, duration = 0.9, share = 0.15 } = {},
) {
  gsap.set(elements, { y, autoAlpha: 0 });
  const observer = new IntersectionObserver(
    contextSafe((entries) =>
      entries.forEach((entry) => {
        if (entry.intersectionRatio < share) return;
        observer.unobserve(entry.target);
        gsap.to(entry.target, { y: 0, autoAlpha: 1, duration, ease: 'power3.out' });
      }),
    ),
    { threshold: [0, share, 1] },
  );
  elements.forEach((element) => observer.observe(element));
  return () => observer.disconnect();
}
