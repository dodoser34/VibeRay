import { gsap } from '../core/gsapSetup';

// Блоки поднимаются, когда на экране видна их доля share. Видимость даёт IntersectionObserver,
// а не ScrollTrigger: тот рассчитывает позиции заранее, и после изменения высоты страницы блок
// в самом конце мог так и не появиться. Вызывать внутри useGSAP с его contextSafe, чтобы анимации
// откатывались вместе с контекстом; возвращает функцию очистки.
export function revealOnScroll(
  elements,
  { contextSafe = (callback) => callback, y = 40, duration = 0.9, share = 0.15 } = {},
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
