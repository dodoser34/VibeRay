import { useLayoutEffect } from 'react';

// Панели поверх карты закрывают часть кадра: сцена получает закрытые полосы
// (MapScene.setViewInsets) и вписывает город и выбранный район в свободную часть, а не под панель.
// Панель помечается атрибутом data-scene-inset: "side" — боковая (слева или справа — по тому, у
// какого края стоит; во всю ширину — значит, на узком экране она встала полосой сверху или снизу),
// "bottom" — нижняя. Скрытая панель
// (data-hidden) кадр не закрывает. Края берутся по раскладке (offset*), без сдвига анимацией: панель
// ещё уезжает, а её место уже известно.
// deps — то, после чего раскладка панелей могла смениться (скрытие, содержимое); размеры
// отслеживает ResizeObserver.
const FULL_WIDTH = 0.6;

export function useSceneInsets({ rootRef, mapRef, enabled, deps }) {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!enabled || !root) return undefined;
    const panels = () =>
      [...root.querySelectorAll('[data-scene-inset]')].filter(
        (element) => !element.hasAttribute('data-hidden') && element.offsetWidth > 0,
      );
    // Положение относительно корня: offset — от неподвижного родителя, родитель — от корня.
    const boxOf = (element) => {
      const rootBox = root.getBoundingClientRect();
      const parentBox = (element.offsetParent ?? root).getBoundingClientRect();
      const left = parentBox.left - rootBox.left + element.offsetLeft;
      const top = parentBox.top - rootBox.top + element.offsetTop;
      return { left, top, right: left + element.offsetWidth, bottom: top + element.offsetHeight };
    };

    const measure = () => {
      const width = root.clientWidth;
      const height = root.clientHeight;
      const insets = { top: 0, right: 0, bottom: 0, left: 0 };
      const sideTops = [];
      panels().forEach((element) => {
        const box = boxOf(element);
        const strip = box.right - box.left > width * FULL_WIDTH;
        if (element.dataset.sceneInset === 'bottom' || (strip && box.top + box.bottom > height)) {
          insets.bottom = Math.max(insets.bottom, height - box.top);
        } else if (strip) insets.top = Math.max(insets.top, box.bottom);
        else {
          if (box.left + box.right < width) insets.left = Math.max(insets.left, box.right);
          else insets.right = Math.max(insets.right, width - box.left);
          sideTops.push(box.top);
        }
      });
      // Над боковыми панелями — полоса таб-бара: город не поднимается под неё
      if (sideTops.length) insets.top = Math.max(insets.top, Math.min(...sideTops));
      mapRef.current?.setViewInsets(insets);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    panels().forEach((element) => observer.observe(element));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps задаёт вызывающий
  }, [rootRef, mapRef, enabled, ...deps]);
}
