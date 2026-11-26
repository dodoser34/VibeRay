import { useCallback, useEffect, useMemo, useRef } from 'react';
import { gsap } from '@/shared/animations/core/gsapSetup';
import { MapFoldTransition } from '@/shared/animations/pageTransition/MapFoldTransition';
import {
  holdPageEntrance,
  releasePageEntrance,
} from '@/shared/animations/pageTransition/pageEntrance';
import '@/shared/animations/pageTransition/MapFoldTransition.css';
import { useLocalizedNavigate } from '@/shared/hooks/useLocalizedNavigate';
import { usePagePath } from '@/shared/hooks/usePagePath';
import { subscribeTheme } from '@/shared/lib/theme/theme';
import nav from '@/texts/en/nav.json';
import { TransitionContext } from './TransitionContext';

// Главная, вход и регистрация — одна страница: переключение между ними анимирует карточку-пропуск.
const HOME_PATHS = ['/', '/login', '/register'];
// Не держать карту на экране дольше этого, даже если страница зависла. С запасом на загрузку
// 3D-комнаты «О проекте» (несколько мегабайт) при медленном соединении.
const HOLD_LIMIT = 15000;
const POINTER_FRESH = 800; // мс: клик не старше этого — точка, откуда вылетает сложенная карта

// Страницы для подписи и вкладки перехода: первая подходящая по пути. Подпись читается при
// обращении — язык меняется на лету.
const entry = (test, tab, readLabel) => ({
  test,
  tab,
  get label() {
    return readLabel();
  },
});
const PAGES = [
  entry(
    (path) => path.startsWith('/map'),
    'map',
    () => nav.pageNames.map,
  ),
  entry(
    (path) => path === '/about',
    'about',
    () => nav.pageNames.about,
  ),
  entry(
    (path) => path === '/support',
    'support',
    () => nav.pageNames.support,
  ),
  entry(
    (path) => path === '/settings',
    'me',
    () => nav.pageNames.settings,
  ),
  entry(
    (path) => path === '/moderation/settings',
    'me',
    () => nav.moderator.settings,
  ),
  ...['map', 'city', 'support'].map((key) =>
    entry(
      (path) => path === `/moderation/${key}`,
      `moderation-${key}`,
      () => nav.moderator.tabs[key].label,
    ),
  ),
  entry(
    (path) => path === '/moderation',
    'moderation-queue',
    () => nav.moderator.tabs.queue.label,
  ),
  entry(
    (path) => path === '/login',
    'login',
    () => nav.pageNames.login,
  ),
  entry(
    (path) => path === '/register',
    'register',
    () => nav.pageNames.register,
  ),
  entry(
    () => true,
    null,
    () => nav.pageNames.home,
  ),
];
// Якорь и параметры адреса (/settings#settings-reports) не меняют страницу назначения.
const pageOf = (path) => PAGES.find((page) => page.test(path.split(/[?#]/)[0]));

// Навигация с анимацией. Страница может зарегистрировать свою анимацию ухода (перехватчик —
// например, пролёт камеры в город); иначе экран закрывает переход «бумажная карта», маршрут
// меняется под ней, карта ждёт загрузки новой страницы (useTransitionReady) и складывается.
export function TransitionProvider({ children }) {
  const navigate = useLocalizedNavigate();
  const pathname = usePagePath();
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

  // Бумажная карта создаётся один раз, после загрузки страницы: её цвета берутся из стилей.
  const ensureMap = useCallback(() => {
    mapRef.current ??= new MapFoldTransition({ gsap, zIndex: 'var(--z-transition)' });
    return mapRef.current;
  }, []);

  // Сменилась тема — карта перерисовывается в новых цветах.
  useEffect(() => subscribeTheme(() => mapRef.current?.refreshTheme()), []);

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
          await navigate(to);
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
        // Страница могла ещё не загрузиться (маршруты ленивые): ждём её, пока карта закрывает
        // экран.
        await navigate(to);
        window.scrollTo(0, 0);
        // Даём новому маршруту отрисоваться и зарегистрировать ожидания, затем ждём их не дольше
        // HOLD_LIMIT.
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
        // Появление страницы не остаётся в ожидании, даже если переход упал.
        releasePageEntrance();
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

  // Таб-бар не двигает подсветку на клик, который всё равно будет отклонён: переход уже идёт.
  const isBusy = useCallback(() => busyRef.current, []);

  const value = useMemo(
    () => ({ go, setInterceptor, holdPage, isBusy }),
    [go, setInterceptor, holdPage, isBusy],
  );
  return <TransitionContext.Provider value={value}>{children}</TransitionContext.Provider>;
}
