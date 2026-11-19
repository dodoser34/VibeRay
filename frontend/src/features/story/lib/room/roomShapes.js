import { isoToScreen, UNIT } from './isometric';

// Пучок листьев растения над точкой (x, y, z): вытянутые лепестки в экранных координатах, веером
// по углам (градусы от вертикали). size — длина листа в единицах мира.
export function leafTuft([x, y, z], size, angles = [-50, -20, 10, 40]) {
  const [cx, cy] = isoToScreen(x, y, z);
  const scaledSize = size * UNIT;
  const pointAt = (angle, distance) => [
    cx + Math.sin(angle) * scaledSize * distance,
    cy - Math.cos(angle) * scaledSize * distance,
  ];
  return angles
    .map((degrees) => {
      const radians = (degrees * Math.PI) / 180;
      const [tx, ty] = pointAt(radians, 1);
      const [ax, ay] = pointAt(radians - 0.35, 0.6);
      const [bx, by] = pointAt(radians + 0.35, 0.6);
      const round1 = (number) => number.toFixed(1);
      return `M${round1(cx)} ${round1(cy)}Q${round1(ax)} ${round1(ay)} ${round1(tx)} ${round1(ty)}Q${round1(bx)} ${round1(by)} ${round1(cx)} ${round1(cy)}z`;
    })
    .join('');
}
