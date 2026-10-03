import { useLiteGraphics } from '@/adaptations/core';
import { Hero3D } from './Hero3D';
import { HeroMap } from './HeroMap';

// Город героя главной: 3D-сцена или, в лёгком режиме графики (слабое устройство, медленная сеть),
// плоская карта с тем же интерфейсом для страницы (пролёт в город, подсветка района).
export function HeroCanvas(props) {
  return useLiteGraphics() ? <HeroMap {...props} /> : <Hero3D {...props} />;
}
