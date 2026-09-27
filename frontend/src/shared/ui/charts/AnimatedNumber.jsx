import { useEffect, useRef } from 'react';
import { gsap, useGSAP } from '@/shared/animations/gsapSetup';
import { formatNumber } from '@/shared/lib/formatNumber';

// Число, которое досчитывает до нового значения (с нуля в первом кадре).
export function AnimatedNumber({ value, formatValue = formatNumber, className }) {
  const ref = useRef(null);
  const shownRef = useRef({ value: 0 });
  const formatRef = useRef(formatValue);

  useEffect(() => {
    formatRef.current = formatValue;
  });

  useGSAP(
    () => {
      const shown = shownRef.current;
      const render = () => (ref.current.textContent = formatRef.current(shown.value));
      gsap.killTweensOf(shown);
      render();
      gsap.to(shown, { value, duration: 0.9, ease: 'power3.out', onUpdate: render });
    },
    { dependencies: [value] },
  );

  return <span ref={ref} className={className} />;
}
