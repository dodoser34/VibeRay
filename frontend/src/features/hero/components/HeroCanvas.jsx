import { useImperativeHandle, useRef, useState } from 'react';
import { useLiteGraphics } from '@/adaptations/core';
import { Hero3D } from './Hero3D';
import { HeroPortrait } from './HeroPortrait';
import { HeroThoughts } from './HeroThoughts';

// Девушка героя главной: 3D-сцена или, в лёгком режиме графики (слабое устройство, медленная сеть),
// готовый кадр той же модели с тем же интерфейсом для страницы (уход за лист, взгляд, подскок).
// Когда она выехала снизу, вокруг головы начинают всплывать мысли; уход к карте их гасит.
export function HeroCanvas({ ref, stacked = false }) {
  const lite = useLiteGraphics();
  const heroRef = useRef(null);
  const thoughtsRef = useRef(null);
  const [risen, setRisen] = useState(false);
  const Hero = lite ? HeroPortrait : Hero3D;

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
      <Hero ref={heroRef} stacked={stacked} onRisen={() => setRisen(true)} />
      <HeroThoughts
        ref={thoughtsRef}
        active={risen}
        stacked={stacked}
        anchor={() => heroRef.current?.headPoint() ?? null}
      />
    </>
  );
}
