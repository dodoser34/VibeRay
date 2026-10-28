import { matrixAttr, planeMatrix } from '../../lib/isometric';

// Плоский рисунок на грани или стене (facing: 'x' | 'y' | 'z', см. planeMatrix): постеры, экран
// монитора, улица за окном, ковёр. Рисунок — в единицах мира (10 см) или мельче, если задан scale.
export function IsoPlane({ facing, at, scale = 1, children, ...rest }) {
  return (
    <g transform={matrixAttr(planeMatrix(facing, at, scale))} {...rest}>
      {children}
    </g>
  );
}
