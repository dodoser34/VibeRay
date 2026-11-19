import { gsap } from '@/shared/animations/core/gsapSetup';
import { prefersReducedMotion } from '@/shared/hooks/useReducedMotion';

// Отклик на нажатие для всех кнопок сайта: кнопка пружинисто проседает под указателем или пальцем и
// отскакивает обратно, от точки нажатия по ней расходится волна. Один обработчик на окно, а не код в
// каждом компоненте: так анимацию получают и кнопки, которых пока нет. Кнопка, которой отклик
// мешает (большая сцена, своя анимация нажатия), получает data-press="off".
const PRESSABLE = 'button, [role="button"], [role="radio"], [role="tab"], [role="checkbox"]';

// Проседание — на несколько пикселей по большей стороне: маленькая круглая кнопка сжимается
// заметно, большая карточка — едва-едва, а не на те же проценты.
const PRESS_DEPTH_PX = 7;
const MAX_PRESS_DEPTH = 0.1;

// Масштаб нажатия — отдельным CSS-свойством scale: оно складывается с transform, который у кнопок
// занимает GSAP (появление страниц и панелей), и с translate наведения.
const scales = new WeakMap();

function tweenScale(element, { then, ...vars }) {
  let state = scales.get(element);
  if (!state) {
    state = { value: 1 };
    scales.set(element, state);
  }
  return gsap.to(state, {
    ...vars,
    overwrite: true,
    onUpdate: () => {
      element.style.scale = String(state.value);
    },
    onComplete: () => {
      if (state.value === 1) element.style.removeProperty('scale');
      then?.();
    },
  });
}

function pressDepth(element) {
  const size = Math.max(element.offsetWidth, element.offsetHeight) || 1;
  return Math.min(MAX_PRESS_DEPTH, PRESS_DEPTH_PX / size);
}

function squash(element) {
  tweenScale(element, { value: 1 - pressDepth(element), duration: 0.12, ease: 'power2.out' });
}

function release(element) {
  tweenScale(element, { value: 1, duration: 0.75, ease: 'elastic.out(1.1, 0.4)' });
}

// Волна цвета текста кнопки (currentColor) — без свечения: полупрозрачный круг гаснет, дорастая
// до дальнего угла. Слой волны обрезан по скруглению кнопки, сама кнопка overflow не меняет.
function ripple(element, clientX, clientY) {
  if (getComputedStyle(element).position === 'static') return;
  const rect = element.getBoundingClientRect();
  const width = element.offsetWidth;
  const height = element.offsetHeight;
  if (!rect.width || !rect.height) return;
  const x = ((clientX - rect.left) / rect.width) * width;
  const y = ((clientY - rect.top) / rect.height) * height;
  const radius = Math.hypot(Math.max(x, width - x), Math.max(y, height - y));

  const layer = document.createElement('span');
  layer.setAttribute('aria-hidden', 'true');
  Object.assign(layer.style, {
    position: 'absolute',
    inset: '0',
    overflow: 'hidden',
    borderRadius: 'inherit',
    pointerEvents: 'none',
  });
  const wave = document.createElement('span');
  Object.assign(wave.style, {
    position: 'absolute',
    left: `${x - radius}px`,
    top: `${y - radius}px`,
    width: `${radius * 2}px`,
    height: `${radius * 2}px`,
    borderRadius: '50%',
    background: 'currentColor',
  });
  layer.append(wave);
  element.append(layer);

  gsap
    .timeline({ onComplete: () => layer.remove() })
    .fromTo(wave, { scale: 0, opacity: 0.22 }, { scale: 1, duration: 0.6, ease: 'power2.out' })
    .to(wave, { opacity: 0, duration: 0.45, ease: 'power1.out' }, 0.2);
}

function pressable(target) {
  const element = target instanceof Element ? target.closest(PRESSABLE) : null;
  if (!element || element.disabled || element.getAttribute('aria-disabled') === 'true') return null;
  if (element.closest('[data-press="off"]')) return null;
  return element;
}

export function installPressFeedback() {
  let pressed = null;

  const onPointerDown = (event) => {
    if (event.button !== 0 || prefersReducedMotion()) return;
    const element = pressable(event.target);
    if (!element) return;
    pressed = element;
    ripple(element, event.clientX, event.clientY);
    squash(element);
  };

  const onPointerUp = () => {
    if (!pressed) return;
    release(pressed);
    pressed = null;
  };

  // Enter и пробел нажимают кнопку без указателя (event.detail === 0): та же пружина и волна из
  // середины кнопки, чтобы отклик видели и те, кто ходит клавиатурой.
  const onClick = (event) => {
    if (event.detail !== 0 || prefersReducedMotion()) return;
    const element = pressable(event.target);
    if (!element) return;
    const rect = element.getBoundingClientRect();
    ripple(element, rect.left + rect.width / 2, rect.top + rect.height / 2);
    tweenScale(element, {
      value: 1 - pressDepth(element),
      duration: 0.1,
      ease: 'power2.out',
      then: () => release(element),
    });
  };

  window.addEventListener('pointerdown', onPointerDown, true);
  window.addEventListener('pointerup', onPointerUp, true);
  window.addEventListener('pointercancel', onPointerUp, true);
  window.addEventListener('click', onClick, true);
}
