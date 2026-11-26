import { useEffect, useState } from 'react';

// Прокрутка: кнопки уезжают, когда страницу листают вниз дальше первого экрана шапки, и
// возвращаются при любом движении вверх; мелкую дрожь пальца не считаем.
const HIDE_AFTER = 120;
const SCROLL_SLACK = 6;

// Страницу листают пальцем: навигация не должна висеть над текстом — вниз она уезжает, вверх
// возвращается; scrolled — страница прокручена (под кнопками нужна подложка). Состояние относится
// к странице, где его получили: новая страница начинает с видимых кнопок. Пока paused (открыто
// меню), навигация не прячется. Липкие элементы страниц (полоса разделов настроек) поднимаются на
// место уехавших кнопок по html[data-nav-hidden].
export function useHideOnScroll(pathname, { paused = false } = {}) {
  const [scroll, setScroll] = useState({ path: null, hidden: false, scrolled: false });
  const here = scroll.path === pathname;
  const hidden = here && scroll.hidden && !paused;
  const scrolled = here && scroll.scrolled;

  useEffect(() => {
    let last = window.scrollY;
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const delta = y - last;
      if (Math.abs(delta) < SCROLL_SLACK && y > 0) return;
      last = y;
      const next = {
        path: pathname,
        hidden: delta > 0 && y > HIDE_AFTER,
        scrolled: y > SCROLL_SLACK,
      };
      setScroll((current) =>
        current.path === next.path &&
        current.hidden === next.hidden &&
        current.scrolled === next.scrolled
          ? current
          : next,
      );
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, [pathname]);

  useEffect(() => {
    document.documentElement.toggleAttribute('data-nav-hidden', hidden);
    return () => document.documentElement.removeAttribute('data-nav-hidden');
  }, [hidden]);

  return { hidden, scrolled };
}
