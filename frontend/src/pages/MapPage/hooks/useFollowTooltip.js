import { useLayoutEffect, useRef } from 'react';
import { placeInViewport, rootScale, viewportBounds } from '@/adaptations/core';

const OFFSET_PX = 16;
const EDGE_PX = 8;

// Подсказка у указателя: следует за мышью без перерисовки React (transform напрямую) и встаёт на
// место сразу, когда меняется её содержимое (hover). У правого и нижнего края окна она
// переворачивается на другую сторону указателя и не выходит за окно (placeInViewport).
export function useFollowTooltip(hover) {
  const tooltipRef = useRef(null);
  const pointerRef = useRef({ x: 0, y: 0 });

  const placeTooltip = () => {
    const tooltip = tooltipRef.current;
    if (!tooltip) return;
    const { x, y } = pointerRef.current;
    const scale = rootScale();
    const offset = OFFSET_PX * scale;
    const position = placeInViewport({
      anchor: { left: x + offset, right: x + offset, top: y, bottom: y },
      size: { width: tooltip.offsetWidth, height: tooltip.offsetHeight },
      gap: offset,
      prefer: ['below', 'above'],
      bounds: viewportBounds(EDGE_PX * scale),
    });
    tooltip.style.transform = `translate(${position.x}px, ${position.y}px)`;
  };

  const onPointerMove = (event) => {
    pointerRef.current = { x: event.clientX, y: event.clientY };
    placeTooltip();
  };

  useLayoutEffect(placeTooltip, [hover]);

  return { tooltipRef, onPointerMove };
}
