import { prefersReducedMotion } from '@/shared/hooks/useReducedMotion';
import { applyTheme, getTheme } from '@/shared/lib/theme/theme';

// Смена темы — плавная смена всей страницы: браузер снимает кадр до и после и растворяет один в
// другом (View Transitions, длительность — в global.css). Где API нет или включено reduced motion —
// тема меняется сразу. Во время перехода между страницами (html[data-transition]) — тоже сразу:
// View Transition заморозил бы кадр с бумажной картой, и после растворения она прыгнула бы вперёд.
export function changeTheme(next) {
  if (next === getTheme()) return;
  const pageTransition = document.documentElement.hasAttribute('data-transition');
  if (!document.startViewTransition || prefersReducedMotion() || pageTransition) {
    applyTheme(next);
    return;
  }
  document.startViewTransition(() => applyTheme(next));
}
