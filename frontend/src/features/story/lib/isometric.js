// Изометрия комнаты истории (ПК): мир в единицах по 10 см — x вдоль правой стены (окно), y вдоль левой
// стены (стол), z вверх. Зритель смотрит из угла +x +y сверху, поэтому у коробки видны верх, грань
// +y (слева снизу) и грань +x (справа снизу).
export const UNIT = 24;
export const C = Math.cos(Math.PI / 6) * UNIT;
const S = 0.5 * UNIT;

export const ROOM = { x: 34, y: 30, z: 23 };

// Рамка комнаты в координатах SVG: слева место под подписи истории, поэтому комната сдвинута вправо.
const MARGIN = 40;
const LEFT_ROOM = 340;
const ORIGIN = [ROOM.y * C + MARGIN + LEFT_ROOM, ROOM.z * UNIT + MARGIN];
export const VIEW = {
  width: (ROOM.x + ROOM.y) * C + 2 * MARGIN + LEFT_ROOM,
  height: ((ROOM.x + ROOM.y) / 2) * UNIT + (ROOM.z + 1.5) * UNIT + 2 * MARGIN,
};

export function iso(x, y, z = 0) {
  return [ORIGIN[0] + (x - y) * C, ORIGIN[1] + (x + y) * S - z * UNIT];
}

// Строка точек для <polygon points>.
export function points(...corners) {
  return corners
    .map((corner) =>
      iso(...corner)
        .map((n) => n.toFixed(1))
        .join(','),
    )
    .join(' ');
}

// Три видимые грани коробки [x, y, z] размером [w, d, h].
export function boxFaces([x, y, z], [w, d, h]) {
  return {
    top: points([x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]),
    left: points([x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]),
    right: points([x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]),
  };
}

// Аффинная матрица [a, b, c, d, e, f] (как у SVG matrix()), которая кладёт плоский рисунок на грань:
// начало рисунка — левый верхний угол грани, ось u рисунка идёт вправо по экрану, ось w — вниз.
//   'y' — стена или грань, смотрящая на +y (правая стена): u вдоль +x, w вниз по z;
//   'x' — грань, смотрящая на +x (левая стена, экран монитора): u вдоль −y, w вниз по z;
//   'z' — пол или верх предмета: u вдоль +x, w вдоль +y.
// scale — сколько единиц мира в одной единице рисунка.
export function planeMatrix(facing, corner, scale = 1) {
  const [e, f] = iso(...corner);
  const k = scale;
  if (facing === 'y') return [C * k, S * k, 0, UNIT * k, e, f];
  if (facing === 'x') return [C * k, -S * k, 0, UNIT * k, e, f];
  return [C * k, S * k, -C * k, S * k, e, f];
}

export const matrixAttr = (m) => `matrix(${m.map((n) => +n.toFixed(4)).join(' ')})`;

export function multiply([a1, b1, c1, d1, e1, f1], [a2, b2, c2, d2, e2, f2]) {
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ];
}

export function invert([a, b, c, d, e, f]) {
  const det = a * d - b * c;
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det];
}

export const apply = ([a, b, c, d, e, f], [x, y]) => [a * x + c * y + e, b * x + d * y + f];
