// Первый кадр 3D-города: камера смотрит строго вниз на середину районов. Те же числа нужны плоской
// карте на экране монитора и телефона — она рисуется ровно в той же рамке, поэтому переход в 3D идёт
// на месте.
export const FOV = 38;
export const TOP_VIEW_HEIGHT = 30;

// Портретные экраны видят меньше по горизонтали — камера отходит вдоль взгляда, но мягко: город на
// телефоне остаётся крупным, а не висит мелким в пустоте.
export function zoomFactor(aspect) {
  return aspect < 1 ? 1.3 / Math.sqrt(aspect) : Math.max(1, 1.3 / aspect);
}

// Середина районов в координатах плоской карты (км, x — восток, y — юг, как у useCityOutline):
// середина рамки контура. Вокруг неё строится первый кадр — город стоит ровно по центру экрана.
export function outlineCenter([x, y, width, height]) {
  return [x + width / 2, y + height / 2];
}

// Что видит первый кадр на холсте width × height с серединой center: рамка [x, y, ширина, высота]
// в км плоской карты.
export function topViewBox(width, height, [cx, cy] = [0, 0]) {
  const visible =
    2 * TOP_VIEW_HEIGHT * zoomFactor(width / height) * Math.tan((FOV * Math.PI) / 360);
  const visibleWidth = (width / height) * visible;
  return [cx - visibleWidth / 2, cy - visible / 2, visibleWidth, visible];
}
