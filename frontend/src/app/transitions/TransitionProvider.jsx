import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { gsap } from '@/shared/animations/gsapSetup';
import { MapFoldTransition } from '@/shared/animations/MapFoldTransition';
import { holdPageEntrance, releasePageEntrance } from '@/shared/animations/pageEntrance';
import '@/shared/animations/MapFoldTransition.css';
import { TransitionContext } from './TransitionContext';
import nav from '@/texts/nav.json';

// Главная, вход и регистрация — одна страница: переключение между ними анимирует карточку-пропуск.
const HOME_PATHS = ['/', '/login', '/register'];
const PAGES = [
  { test: (p) => p.startsWith('/map'), label: nav.pageNames.map, tab: 'map' },
  { test: (p) => p === '/about', label: nav.pageNames.about, tab: 'about' },
  { test: (p) => p === '/support', label: nav.pageNames.support, tab: 'support' },
  { test: (p) => p === '/login', label: nav.pageNames.login, tab: 'login' },
  { test: (p) => p === '/register', label: nav.pageNames.register, tab: 'register' },
  { test: () => true, label: nav.pageNames.home, tab: null },
];
const pageOf = (path) => PAGES.find((page) => page.test(path));
const HOLD_LIMIT = 6000; // не держать карту на экране дольше этого, даже если страница зависла
const POINTER_FRESH = 800; // мс: клик не старше этого — точка, откуда вылетает сложенная карта

// Навигация с анимацией. Страница может зарегистрировать свою анимацию ухода (перехватчик —
// например, пролёт камеры в город); иначе экран закрывает переход «бумажная карта», маршрут
// меняется под ней, карта ждёт загрузки новой страницы (useTransitionReady) и складывается.
export function TransitionProvider({ children }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const pathRef = useRef(pathname);
  const interceptorRef = useRef(null);
  const busyRef = useRef(false);
  const mapRef = useRef(null);
  const pointerRef = useRef(null);
  const holdsRef = useRef(new Set());
  const waitersRef = useRef([]);

  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  // Бумажная карта рисуется один раз, после загрузки страницы (её цвета берутся из стилей).
  const ensureMap = useCallback(() => {
    mapRef.current ??= new MapFoldTransition({ gsap, zIndex: 'var(--z-transition)' });
    return mapRef.current;
  }, []);

  useEffect(() => {
    const onPointer = (event) => {
      pointerRef.current = { x: event.clientX, y: event.clientY, time: performance.now() };
    };
    let timer = null;
    const prepare = () => {
      timer = setTimeout(ensureMap, 400);
    };
    if (document.readyState === 'complete') prepare();
    else window.addEventListener('load', prepare, { once: true });
    window.addEventListener('pointerdown', onPointer, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('load', prepare);
      window.removeEventListener('pointerdown', onPointer, true);
      mapRef.current?.dispose();
      mapRef.current = null;
    };
  }, [ensureMap]);

  // Страница вызывает это (через useTransitionReady), пока грузятся её данные.
  const holdPage = useCallback(() => {
    const token = Symbol('hold');
    holdsRef.current.add(token);
    return () => {
      holdsRef.current.delete(token);
      if (holdsRef.current.size) return;
      waitersRef.current.forEach((resolve) => resolve());
      waitersRef.current = [];
    };
  }, []);

  const go = useCallback(
    async (to) => {
      const from = pathRef.current;
      if (busyRef.current || to === from) return;
      busyRef.current = true;
      try {
        const custom = interceptorRef.current?.(to);
        const samePage = HOME_PATHS.includes(from) && HOME_PATHS.includes(to);
        if (custom || samePage) {
          await custom;
          navigate(to);
          return;
        }

        const transition = ensureMap();
        // Таб-бар остаётся над бумажной картой, чтобы было видно, как подсветка едет к новой
        // странице.
        document.documentElement.dataset.transition = 'true';
        const target = pageOf(to);
        const tab = target.tab && document.querySelector(`[data-key="${target.tab}"]`);
        const pointer = pointerRef.current;
        const fresh = pointer && performance.now() - pointer.time < POINTER_FRESH;
        await transition.cover({
          x: fresh ? pointer.x : window.innerWidth / 2,
          y: fresh ? pointer.y : window.innerHeight / 2,
          label: target.label,
          from: pageOf(from).label,
          targetRect: tab?.getBoundingClientRect() ?? null,
        });
        // Новая страница монтируется под картой; её появление ждёт, пока карта начнёт складываться.
        holdPageEntrance();
        navigate(to);
        window.scrollTo(0, 0);
        // Даём новому маршруту отрисоваться и зарегистрировать ожидания, затем ждём их (с
        // ограничением).
        const loaded = new Promise((resolve) => {
          setTimeout(() => {
            if (!holdsRef.current.size) resolve();
            else waitersRef.current.push(resolve);
          }, 60);
          setTimeout(resolve, HOLD_LIMIT);
        });
        await transition.waitFor(loaded);
        await transition.reveal({
          page: document.querySelector('main'),
          onFold: releasePageEntrance,
        });
      } finally {
        releasePageEntrance(); // никогда не оставлять появление страницы в ожидании (например, если переход упал)
        delete document.documentElement.dataset.transition;
        busyRef.current = false;
      }
    },
    [navigate, ensureMap],
  );

  const setInterceptor = useCallback((interceptor) => {
    interceptorRef.current = interceptor;
    return () => {
      if (interceptorRef.current === interceptor) interceptorRef.current = null;
    };
  }, []);

  const value = useMemo(() => ({ go, setInterceptor, holdPage }), [go, setInterceptor, holdPage]);
  return <TransitionContext.Provider value={value}>{children}</TransitionContext.Provider>;
}
