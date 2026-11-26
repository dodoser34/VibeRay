// Общие размеры комнаты истории, которые нужны нескольким частям рисунка и камере (единицы — 10 см,
// оси — lib/room/isometric.js).

// Проём окна в правой стене (y = 0).
export const WINDOW = { x0: 13, x1: 25, z0: 8.5, z1: 19 };

// Экран монитора: плоскость грани +x корпуса, левый верхний угол (каким его видит зритель), рисунок
// экрана 640 × 360 и его масштаб к единицам мира (ширина экрана — 61 см).
export const SCREEN = {
  corner: [2, 17.05, 13.25],
  size: [640, 360],
  scale: 6.1 / 640,
};

// Рамка карты на экране монитора (км) для кадра width × height: в конце наезда рисунок экрана
// накрывает кадр по центру с запасом cover, а 3D-город рисуется во весь кадр — поэтому рамка
// первого кадра города переводится в координаты рисунка экрана, и карта переходит в 3D на месте.
export function monitorMapBox([minX, minY, , viewHeight], width, height, cover) {
  const [screenWidth, screenHeight] = SCREEN.size;
  const scale = Math.max(width / screenWidth, height / screenHeight) * cover;
  const kmPerPx = viewHeight / height;
  return [
    minX + (width / 2 - (screenWidth / 2) * scale) * kmPerPx,
    minY + (height / 2 - (screenHeight / 2) * scale) * kmPerPx,
    screenWidth * scale * kmPerPx,
    screenHeight * scale * kmPerPx,
  ];
}
