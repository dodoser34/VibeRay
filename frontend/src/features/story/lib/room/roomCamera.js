import { gsap } from '@/shared/animations/core/gsapSetup';
import { apply, invert, matrixAttr, multiply, VIEW } from './isometric';

// Запас, с которым экран монитора перекрывает кадр в конце наезда: края монитора уходят за кадр.
export const COVER = 1.04;
// Наклон диорамы за курсором (градусы) на общем плане; к наезду он сходит на нет.
const TILT = 4;

// «Камера» изометрической комнаты: одна аффинная матрица на группе комнаты. t = 0 — вся комната,
// t = 1 — экран монитора анфас во весь кадр. Между ними масштаб растёт по экспоненте (наезд выглядит
// равномерным), а изометрический перекос экрана плавно снимается — будто камера разворачивается
// к монитору. Кадр пересчитывается при изменении размера окна. На общем плане комната чуть
// поворачивается за курсором (tilt — обёртка, которой даём перспективу), как диорама на столе.
export class RoomCamera {
  // svg — корневой <svg> комнаты (viewBox = VIEW, xMidYMid meet); group — группа, которую двигаем;
  // screen — матрица плоскости экрана (planeMatrix) и размер рисунка экрана [ширина, высота].
  constructor(svg, group, { matrix, size }, { tilt = null } = {}) {
    this.svg = svg;
    this.group = group;
    this.screen = matrix;
    this.size = size;
    this.t = 0;
    this.observer = new ResizeObserver(() => this.set(this.t));
    this.observer.observe(svg);
    this.pointer = [0, 0];
    if (tilt) {
      gsap.set(tilt, { transformPerspective: 1800 });
      this.turnX = gsap.quickTo(tilt, 'rotationX', { duration: 0.9, ease: 'power3' });
      this.turnY = gsap.quickTo(tilt, 'rotationY', { duration: 0.9, ease: 'power3' });
      this.onPointer = (event) => {
        this.pointer = [
          (event.clientX / window.innerWidth) * 2 - 1,
          (event.clientY / window.innerHeight) * 2 - 1,
        ];
        this.turn();
      };
      window.addEventListener('pointermove', this.onPointer);
    }
  }

  turn() {
    if (!this.turnX) return;
    const amount = TILT * Math.max(0, 1 - this.t * 3);
    this.turnX(-this.pointer[1] * amount);
    this.turnY(this.pointer[0] * amount);
  }

  // Матрица кадра «экран анфас»: рисунок экрана по центру видимой части viewBox, с перекрытием.
  target() {
    const { clientWidth: width, clientHeight: height } = this.svg;
    const fit = Math.min(width / VIEW.width, height / VIEW.height) || 1;
    const [w, h] = this.size;
    const k = Math.max(width / fit / w, height / fit / h) * COVER;
    const view = [k, 0, 0, k, VIEW.width / 2 - (k * w) / 2, VIEW.height / 2 - (k * h) / 2];
    return multiply(view, invert(this.screen));
  }

  set(t) {
    this.t = t;
    this.turn();
    const [a, b, c, d] = this.target();
    const zoom = Math.sqrt(Math.abs(a * d - b * c));
    const scale = zoom ** t;
    const mix = (from, to) => from + (to - from) * t;
    const linear = [
      scale * mix(1, a / zoom),
      scale * mix(0, b / zoom),
      scale * mix(0, c / zoom),
      scale * mix(1, d / zoom),
    ];
    // Центр экрана монитора едет к центру кадра по прямой.
    const center = apply(this.screen, [this.size[0] / 2, this.size[1] / 2]);
    const goal = [VIEW.width / 2, VIEW.height / 2];
    const moved = [mix(center[0], goal[0]), mix(center[1], goal[1])];
    const [x, y] = apply([...linear, 0, 0], center);
    this.group.setAttribute('transform', matrixAttr([...linear, moved[0] - x, moved[1] - y]));
  }

  dispose() {
    this.observer.disconnect();
    if (this.onPointer) window.removeEventListener('pointermove', this.onPointer);
  }
}
