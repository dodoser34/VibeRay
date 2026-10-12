import { useImperativeHandle, useRef, useState } from 'react';
import { Hero3D } from './Hero3D';
import { HeroThoughts } from './HeroThoughts';

// Девушка героя главной — всегда 3D-модель максимального качества (другой версии нет, в том числе
// в лёгком режиме графики). Когда она выехала снизу, вокруг головы начинают всплывать мысли; уход
// к карте их гасит.
export function HeroCanvas({ ref, stacked = false }) {
  const heroRef = useRef(null);
  const thoughtsRef = useRef(null);
  const [risen, setRisen] = useState(false);

  useImperativeHandle(
    ref,
    () => ({
      flyIntoCity: (options) => {
        thoughtsRef.current?.hide();
        return heroRef.current?.flyIntoCity(options);
      },
      setFlyProgress: (progress) => {
        thoughtsRef.current?.fade(progress);
        heroRef.current?.setFlyProgress(progress);
      },
      glance: () => heroRef.current?.glance(),
      cheer: () => heroRef.current?.cheer(),
      catchPoint: () => heroRef.current?.catchPoint() ?? null,
    }),
    [],
  );

  return (
    <>
      <Hero3D ref={heroRef} stacked={stacked} onRisen={() => setRisen(true)} />
      <HeroThoughts
        ref={thoughtsRef}
        active={risen}
        stacked={stacked}
        anchor={() => heroRef.current?.headPoint() ?? null}
      />
    </>
  );
}
