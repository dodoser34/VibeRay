import { renderQuality } from '@/adaptations/core';
import { gsap, useGSAP } from '@/shared/animations/gsapSetup';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';

// Параллакс героя главной — имитация объёма: слой плавно следует за указателем. move(px, py)
// получает положение указателя от −1 до 1 по каждой оси и возвращает свойства слоя (только
// transform). Где мыши нет (телефоны, планшеты), слой спокойно покачивается сам — idle(t), t от −1
// до 1 по синусу. При «уменьшить движение» эффекта нет.
export function usePointerParallax(targetRef, { move, idle, duration = 1.1 }) {
  const reduced = useReducedMotion();

  useGSAP(
    () => {
      const target = targetRef.current;
      if (!target || reduced) return undefined;

      if (!renderQuality().parallax) {
        if (!idle) return undefined;
        const sway = { t: 0 };
        const tween = gsap.to(sway, {
          t: 1,
          duration: 7,
          ease: 'none',
          repeat: -1,
          onUpdate: () => gsap.set(target, idle(Math.sin(sway.t * Math.PI * 2))),
        });
        return () => tween.kill();
      }

      const setters = Object.fromEntries(
        Object.keys(move(0, 0)).map((key) => [
          key,
          gsap.quickTo(target, key, { duration, ease: 'power3.out' }),
        ]),
      );
      const onMove = (event) => {
        const props = move(
          (event.clientX / window.innerWidth) * 2 - 1,
          (event.clientY / window.innerHeight) * 2 - 1,
        );
        Object.entries(props).forEach(([key, value]) => setters[key](value));
      };
      window.addEventListener('pointermove', onMove);
      return () => window.removeEventListener('pointermove', onMove);
    },
    { dependencies: [reduced] },
  );
}
