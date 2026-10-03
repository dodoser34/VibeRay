import { useImperativeHandle, useRef, useState } from 'react';
import { moodFill } from '@/features/map';
import { gsap, useGSAP } from '@/shared/animations/gsapSetup';
import { useCityOutline } from '@/shared/hooks/useCityOutline';
import { usePageEntered } from '@/shared/hooks/usePageEntered';
import styles from './HeroMap.module.css';

// Лёгкая версия города героя: Костанай плоской картой (цвета настроения районов) вместо WebGL. Тот
// же интерфейс, что у Hero3D: пролёт в город — приближение с растворением, подсветка и вспышка
// района, его экранная точка для анимации регистрации.
export function HeroMap({ ref, city, moods, stacked = false }) {
  const rootRef = useRef(null);
  const svgRef = useRef(null);
  const [active, setActive] = useState(null);
  const outline = useCityOutline(city, null, 0);
  const entered = usePageEntered();
  const path = (slug) => svgRef.current?.querySelector(`[data-slug="${slug}"]`);

  useGSAP(
    () => {
      if (!entered || !outline) return;
      gsap.from('[data-slug]', {
        autoAlpha: 0,
        scale: 0.92,
        transformOrigin: '50% 50%',
        duration: 0.9,
        stagger: 0.05,
        ease: 'power2.out',
      });
    },
    { scope: rootRef, dependencies: [entered, Boolean(outline)] },
  );

  useImperativeHandle(
    ref,
    () => ({
      flyIntoCity: ({ duration = 1.5 } = {}) =>
        gsap.to(svgRef.current, { scale: 2.2, autoAlpha: 0, duration, ease: 'power2.in' }),
      setFlyProgress: (progress) =>
        gsap.set(svgRef.current, { scale: 1 + progress * 1.2, autoAlpha: 1 - progress * 0.8 }),
      highlightDistrict: setActive,
      flashDistrict: (slug) => {
        setActive(slug);
        const target = path(slug);
        if (!target) return;
        gsap.fromTo(
          target,
          { scale: 1 },
          { scale: 1.08, transformOrigin: '50% 50%', duration: 0.25, yoyo: true, repeat: 1 },
        );
      },
      districtScreenPosition: (slug) => {
        const target = path(slug)?.getBoundingClientRect();
        if (!target) return null;
        const box = rootRef.current.getBoundingClientRect();
        return {
          x: target.left + target.width / 2 - box.left,
          y: target.top + target.height / 2 - box.top,
        };
      },
    }),
    [],
  );

  return (
    <div ref={rootRef} className={styles.root} aria-hidden="true">
      {outline && (
        <svg
          ref={svgRef}
          className={styles.map}
          data-stacked={stacked || undefined}
          viewBox={outline.viewBox.join(' ')}
          preserveAspectRatio="xMidYMid meet"
        >
          {outline.districts.map((district) => (
            <path
              key={district.slug}
              d={district.d}
              data-slug={district.slug}
              data-active={district.slug === active || undefined}
              className={styles.district}
              style={{
                '--fill': moods
                  ? moodFill(moods.districts[district.slug])
                  : `var(--district-${district.palette})`,
              }}
            />
          ))}
        </svg>
      )}
    </div>
  );
}
