import { useContext, useEffect, useLayoutEffect } from 'react';
import { TransitionContext } from './TransitionContext';

export function useTransitionNavigate() {
  return useContext(TransitionContext).go;
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
