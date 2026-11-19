import { iso, UNIT } from './isometric';

// Пучок листьев растения над точкой (x, y, z): вытянутые лепестки в экранных координатах, веером
// по углам (градусы от вертикали). size — длина листа в единицах мира.
export function leafTuft([x, y, z], size, angles = [-50, -20, 10, 40]) {
  const [cx, cy] = iso(x, y, z);
  const s = size * UNIT;
  const at = (angle, k) => [cx + Math.sin(angle) * s * k, cy - Math.cos(angle) * s * k];
  return angles
    .map((degrees) => {
      const r = (degrees * Math.PI) / 180;
      const [tx, ty] = at(r, 1);
      const [ax, ay] = at(r - 0.35, 0.6);
      const [bx, by] = at(r + 0.35, 0.6);
      const f = (n) => n.toFixed(1);
      return `M${f(cx)} ${f(cy)}Q${f(ax)} ${f(ay)} ${f(tx)} ${f(ty)}Q${f(bx)} ${f(by)} ${f(cx)} ${f(cy)}z`;
    })
    .join('');
}
