import { useLayoutEffect, useRef } from 'react';
import { gsap } from '../gsapSetup';

// Строки с data-flip="<key>" переезжают на новое место при смене порядка (FLIP): после того как
// React их переставит, каждая строка начинает с прежнего места на экране и анимируется к нулю.
export function useFlipList(containerRef, orderKey) {
  const positions = useRef(new Map());

  useLayoutEffect(() => {
    const rows = [...(containerRef.current?.querySelectorAll('[data-flip]') ?? [])];
    const next = new Map(rows.map((row) => [row.dataset.flip, row.offsetTop]));
    rows.forEach((row) => {
      const before = positions.current.get(row.dataset.flip);
      const after = next.get(row.dataset.flip);
      if (before === undefined || before === after) return;
      gsap.fromTo(
        row,
        { y: before - after + Number(gsap.getProperty(row, 'y')) },
        { y: 0, duration: 0.6, ease: 'power3.out', overwrite: 'auto' },
      );
    });
    positions.current = next;
  }, [containerRef, orderKey]);
}
