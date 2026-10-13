import { useImperativeHandle, useRef, useState } from 'react';
import { HeroGirl } from './HeroGirl';
import { HeroThoughts } from './HeroThoughts';

// Девушка героя главной (иллюстрация). Когда она выехала снизу, вокруг головы начинают всплывать
// мысли; уход к карте их гасит.
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
      <HeroGirl ref={heroRef} stacked={stacked} onRisen={() => setRisen(true)} />
      <HeroThoughts
        ref={thoughtsRef}
        active={risen}
        stacked={stacked}
        anchor={() => heroRef.current?.headPoint() ?? null}
      />
    </>
  );
}
