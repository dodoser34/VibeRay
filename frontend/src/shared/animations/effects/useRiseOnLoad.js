import { useRef } from 'react';
import { gsap, useGSAP } from '../core/gsapSetup';

// Данные панели догрузились (loading: true → false — другой период, первая загрузка после
// заглушки): блоки контейнера поднимаются по очереди. Новую панель целиком анимирует страница,
// здесь — только обновление данных внутри открытой панели. clearProps: прозрачность и сдвиг дальше
// снова у CSS.
export function useRiseOnLoad(containerRef, loading) {
  const wasLoading = useRef(loading);

  useGSAP(
    () => {
      const arrived = wasLoading.current && !loading;
      wasLoading.current = loading;
      if (!arrived || !containerRef.current) return;
      gsap.fromTo(
        containerRef.current.children,
        { autoAlpha: 0, y: 16 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.5,
          stagger: 0.05,
          ease: 'power3.out',
          clearProps: 'transform,opacity,visibility',
        },
      );
    },
    { dependencies: [loading] },
  );
}
