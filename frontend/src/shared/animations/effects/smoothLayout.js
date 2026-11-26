import { prefersReducedMotion } from '@/shared/hooks/useReducedMotion';
import { gsap } from '../core/gsapSetup';

// Плавное «догоняние» раскладки: когда содержимое меняет размер (другая форма, шаг регистрации,
// подсказка под полем), элементы не прыгают в новое положение, а доезжают до него. ResizeObserver
// срабатывает после раскладки, но до отрисовки, поэтому кадра со скачком не бывает. Анимируется
// только transform. Если изменилось окно, раскладка перестроилась целиком — тогда без анимации.

const DURATION = 0.6;
const EASE = 'power2.out';

const viewportSize = () => `${window.innerWidth}x${window.innerHeight}`;

function watchLayout(element, read, onChange) {
  let value = read();
  let viewport = viewportSize();
  const observer = new ResizeObserver(() => {
    const previous = value;
    const sameViewport = viewport === viewportSize();
    value = read();
    viewport = viewportSize();
    if (previous === value || !sameViewport || prefersReducedMotion()) return;
    onChange(previous, value);
  });
  observer.observe(element);
  return () => observer.disconnect();
}

// Фон карточки (surface — отдельный слой под содержимым) растягивается от прежней высоты карточки к
// новой от верхнего края. Возвращает функцию отписки.
export function smoothHeight(card, surface) {
  const stop = watchLayout(
    card,
    () => card.offsetHeight,
    (previous, next) => {
      if (!previous || !next) return; // карточку прятали — растягивать нечего
      // Видимая сейчас высота фона: смена могла прийти посреди прошлой анимации.
      const shown = gsap.getProperty(surface, 'scaleY') * previous;
      gsap.fromTo(
        surface,
        { scaleY: shown / next },
        { scaleY: 1, transformOrigin: '50% 0%', duration: DURATION, ease: EASE, overwrite: true },
      );
    },
  );
  return () => {
    stop();
    gsap.killTweensOf(surface);
    gsap.set(surface, { clearProps: 'transform' });
  };
}

// Блок, который раскладка центрирует по вертикали, при смене своей высоты съезжает на полразницы —
// вместо скачка он плавно доезжает до нового места. Возвращает функцию отписки.
export function smoothShift(element) {
  const stop = watchLayout(
    element,
    () => element.offsetTop,
    (previous, next) => {
      const y = gsap.getProperty(element, 'y') + previous - next;
      gsap.fromTo(element, { y }, { y: 0, duration: DURATION, ease: EASE, overwrite: 'auto' });
    },
  );
  return () => {
    stop();
    gsap.killTweensOf(element, 'y');
  };
}
