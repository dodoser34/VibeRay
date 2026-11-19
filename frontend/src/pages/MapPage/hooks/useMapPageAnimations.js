import { useRef } from 'react';
import { gsap, useGSAP } from '@/shared/animations/core/gsapSetup';

// Анимации страницы карты: панели выезжают, когда страница видна (после перехода страницы, если он
// был); при переключении карта ↔ дашборд содержимое панелей поднимается; при смене содержимого
// панели (обзор → район → проблема → «Сообщить о проблеме») части новой панели поднимаются по
// очереди. Цели — data-panel и data-ui="map-detail" / "map-overview" внутри pageRef
// (MapPanelsLayout, MapSheetLayout).
export function useMapPageAnimations({ pageRef, fadeRef, entered, view, detailKey }) {
  const viewRef = useRef(view);
  const detailRef = useRef({ key: detailKey, view });

  useGSAP(
    () => {
      if (!entered) return;
      gsap.to(fadeRef.current, { autoAlpha: 0, duration: 0.9, ease: 'power2.out' });
      // clearProps: GSAP оставляет в стиле `translate: none`, а скрытую панель за край экрана
      // уводит CSS-свойство translate.
      gsap.from('[data-panel="left"]', {
        x: -60,
        autoAlpha: 0,
        duration: 1,
        ease: 'expo.out',
        delay: 0.9,
        clearProps: 'all',
      });
      gsap.from('[data-panel="right"]', {
        x: 60,
        autoAlpha: 0,
        duration: 1,
        ease: 'expo.out',
        delay: 1.05,
        clearProps: 'all',
      });
      // clearProps: после анимации элементами снова управляет CSS («+» прячется, пока сообщают о
      // проблеме, чип центрируется своим transform).
      gsap.from('[data-panel="bottom"], [data-panel="corner"], [data-panel="float"]', {
        y: 40,
        autoAlpha: 0,
        duration: 0.8,
        ease: 'expo.out',
        delay: 1.3,
        clearProps: 'transform,opacity,visibility',
      });
    },
    { scope: pageRef, dependencies: [entered] },
  );

  // Переключение между картой и дашбордом: содержимое панелей поднимается.
  useGSAP(
    () => {
      if (viewRef.current === view) return;
      viewRef.current = view;
      gsap.fromTo(
        '[data-panel] > [data-panel-body] > *',
        { autoAlpha: 0, y: 16 },
        { autoAlpha: 1, y: 0, duration: 0.55, stagger: 0.05, ease: 'power3.out' },
      );
    },
    { scope: pageRef, dependencies: [view] },
  );

  // Новое содержимое панели: заголовок, тело и кнопки поднимаются друг за другом. Если вместе с ним
  // сменился вид (карта ↔ дашборд), анимирует эффект выше. clearProps: прозрачность тела панели
  // дальше ведёт CSS (полупрозрачное, пока грузятся данные).
  useGSAP(
    () => {
      const previous = detailRef.current;
      detailRef.current = { key: detailKey, view };
      if (previous.key === detailKey || previous.view !== view) return;
      gsap.fromTo(
        '[data-ui="map-detail"] > *, [data-ui="map-overview"] > *',
        { autoAlpha: 0, y: 14 },
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
    { scope: pageRef, dependencies: [detailKey] },
  );
}
