import { prefersReducedMotion } from '@/shared/hooks/useReducedMotion';
import { applyTheme, getTheme } from '@/shared/lib/theme';

// Смена темы — плавная смена всей страницы: браузер снимает кадр до и после и растворяет один в
// другом (View Transitions, длительность — в global.css). Где API нет или включено reduced motion —
// тема меняется сразу.
export function changeTheme(next) {
  if (next === getTheme()) return;
  if (!document.startViewTransition || prefersReducedMotion()) {
    applyTheme(next);
    return;
  }
  document.startViewTransition(() => applyTheme(next));
}
