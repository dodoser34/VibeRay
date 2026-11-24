import { useLayoutEffect, useRef } from 'react';

const OFFSET_PX = 16;

// Подсказка у указателя: следует за мышью без перерисовки React (transform напрямую) и встаёт на
// место сразу, когда меняется её содержимое (hover).
export function useFollowTooltip(hover) {
  const tooltipRef = useRef(null);
  const pointerRef = useRef({ x: 0, y: 0 });

  const placeTooltip = () => {
    const { x, y } = pointerRef.current;
    if (tooltipRef.current)
      tooltipRef.current.style.transform = `translate(${x + OFFSET_PX}px, ${y + OFFSET_PX}px)`;
  };

  const onPointerMove = (event) => {
    pointerRef.current = { x: event.clientX, y: event.clientY };
    placeTooltip();
  };

  useLayoutEffect(placeTooltip, [hover]);

  return { tooltipRef, onPointerMove };
}
