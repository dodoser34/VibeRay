import { useCallback, useContext, useEffect, useLayoutEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { TransitionContext } from './TransitionContext';

export function useTransitionNavigate() {
  return useContext(TransitionContext).go;
}

// Переход, который знает про карту: внутри неё (город ↔ район ↔ проблема ↔ дашборд) страница не
// меняется, поэтому бумажный переход не нужен — только смена адреса.
export function usePageNavigate() {
  const go = useTransitionNavigate();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return useCallback(
    (to) => (pathname.startsWith('/map') && to.startsWith('/map') ? navigate(to) : go(to)),
    [pathname, navigate, go],
  );
}

// Регистрирует асинхронную анимацию ухода для текущей страницы. Передавайте стабильную
// (мемоизированную) функцию.
export function useNavigationInterceptor(interceptor) {
  const { setInterceptor } = useContext(TransitionContext);
  useEffect(() => setInterceptor(interceptor), [setInterceptor, interceptor]);
}

// Пока `ready` равно false, переход держит на экране фазу «маршрут» (с ограничением по времени),
// чтобы новая страница появилась уже загруженной.
export function useTransitionReady(ready) {
  const { holdPage } = useContext(TransitionContext);
  useLayoutEffect(() => (ready ? undefined : holdPage()), [ready, holdPage]);
}
