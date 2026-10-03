import { gsap } from '@/shared/animations/gsapSetup';
import { CHAPTER } from '../content';

const at = (chapter, offset = 0) => chapter * CHAPTER + offset;
// Центр экрана монитора в координатах иллюстрации (StoryIllustration, viewBox 1600×900).
const SCREEN = '780 437';

// Лёгкая версия сцены истории — тот же интерфейс, что у StoryScene (ready, setCity, buildTimeline,
// dispose), но анимирует плоскую иллюстрацию (StoryIllustration): наезд на монитор, вопрос на
// экране, затем 2D-карта — районы, цвета настроения, метки проблем. Без WebGL и без загрузок.
export class LiteStage {
  constructor(root) {
    this.root = root;
    this.ready = Promise.resolve();
  }

  // Карту рисует React из тех же данных — сцене ничего строить не нужно.
  setCity() {}

  buildTimeline(tl) {
    const q = gsap.utils.selector(this.root);
    const one = (name) => q(`[data-lite="${name}"]`);
    const map = one('map');

    // 1–2. Наезд на монитор, на экране печатается вопрос, камера «входит» в экран.
    tl.fromTo(
      one('zoom'),
      { scale: 1 },
      { scale: 1.9, svgOrigin: SCREEN, duration: 9, ease: 'power2.inOut' },
      at(0),
    );
    tl.fromTo(one('question'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 2.4 }, at(1, 5));
    tl.to(
      one('zoom'),
      { scale: 5.5, svgOrigin: SCREEN, duration: 4.3, ease: 'power2.in' },
      at(1, 5.5),
    );

    // 3. Город: комната уходит под монтажной склейкой (fade в StoryExperience), районы появляются.
    tl.set(one('room'), { autoAlpha: 0 }, at(2));
    tl.set(map, { autoAlpha: 1 }, at(2));
    tl.from(
      one('district'),
      { autoAlpha: 0, scale: 0.9, transformOrigin: '50% 50%', duration: 1.2, stagger: 0.12 },
      at(2, 0.3),
    );
    tl.fromTo(map, { scale: 1 }, { scale: 1.06, duration: at(8) - at(2) }, at(2));

    // 4. Настроения: районы перекрашиваются (плавный переход цвета — в CSS).
    tl.set(map, { attr: { 'data-step': 'mood' } }, at(3, 4.5));

    // 5. Проблемы: метки падают на карту.
    tl.from(
      one('pin'),
      { autoAlpha: 0, y: -0.6, duration: 0.8, stagger: 0.08, ease: 'back.out(2)' },
      at(4, 2.5),
    );
    return tl;
  }

  dispose() {}
}
