// Первый кадр 3D-города: камера смотрит строго вниз. Те же числа нужны плоской карте на экране
// монитора и телефона — она рисуется ровно в той же рамке, поэтому переход в 3D идёт на месте.
export const FOV = 38;
export const TOP_VIEW_HEIGHT = 30;
// На портретных экранах центр картинки поднят на эту долю высоты (место под подписями внизу).
export const PORTRAIT_SHIFT = 0.1;

// Портретные экраны видят меньше по горизонтали — камера отходит вдоль взгляда, но мягко: город на
// телефоне остаётся крупным, а не висит мелким в пустоте.
export function zoomFactor(aspect) {
  return aspect < 1 ? 1.3 / Math.sqrt(aspect) : Math.max(1, 1.3 / aspect);
}

// Что видит первый кадр на холсте width × height: рамка [x, y, ширина, высота] в км проекции города
// (север вверх, как у useCityOutline).
export function topViewBox(width, height) {
  const aspect = width / height;
  const visible = 2 * TOP_VIEW_HEIGHT * zoomFactor(aspect) * Math.tan((FOV * Math.PI) / 360);
  const kmPerPx = visible / height;
  const shift = aspect < 1 ? PORTRAIT_SHIFT * visible : 0;
  return [(-width / 2) * kmPerPx, -visible / 2 + shift, width * kmPerPx, visible];
}
