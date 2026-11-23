// Матрица окон (CSS px) для проверки вёрстки: от телефона 320 px до 8K, от 9:21 до 32:9.
// quick — короткий прогон на каждый шаг работы, остальные окна — в полном (test:layout:full).
// touch — сенсорное устройство: pointer: coarse, цели не меньше 44 px.
export const VIEWPORTS = [
  // Телефоны стоя
  { name: 'phone-320', width: 320, height: 568, touch: true },
  { name: 'phone-360', width: 360, height: 740, touch: true },
  { name: 'phone-390', width: 390, height: 844, touch: true, quick: true },
  { name: 'phone-430', width: 430, height: 932, touch: true },
  // Телефоны лёжа
  { name: 'phone-land-568', width: 568, height: 320, touch: true },
  { name: 'phone-land-812', width: 812, height: 375, touch: true, quick: true },
  { name: 'phone-land-932', width: 932, height: 430, touch: true },
  // Планшеты и складные
  { name: 'tablet-768', width: 768, height: 1024, touch: true, quick: true },
  { name: 'tablet-820', width: 820, height: 1180, touch: true },
  { name: 'fold-884', width: 884, height: 1104, touch: true },
  { name: 'tablet-1024p', width: 1024, height: 1366, touch: true },
  { name: 'tablet-land-1024', width: 1024, height: 768, touch: true, quick: true },
  { name: 'tablet-land-1180', width: 1180, height: 820, touch: true },
  { name: 'tablet-land-1366', width: 1366, height: 1024, touch: true },
  // Квадратные окна
  { name: 'square-1000', width: 1000, height: 1000, quick: true },
  { name: 'square-1400', width: 1400, height: 1400 },
  // Низкие окна и ноутбуки
  { name: 'short-1100', width: 1100, height: 600, quick: true },
  { name: 'laptop-1280', width: 1280, height: 600 },
  { name: 'laptop-1366', width: 1366, height: 657, quick: true },
  { name: 'laptop-1536', width: 1536, height: 730 },
  { name: 'laptop-1440', width: 1440, height: 790 },
  // Зум браузера 175 % и 200 % на мониторе Full HD
  { name: 'zoom-175', width: 1097, height: 543 },
  { name: 'zoom-200', width: 960, height: 475 },
  // Обычный монитор
  { name: 'fhd', width: 1920, height: 950, quick: true },
  // Большие
  { name: 'qhd', width: 2560, height: 1310 },
  { name: 'uhd', width: 3840, height: 2040, quick: true },
  { name: '8k', width: 7680, height: 4200 },
  // Ультраширокие 21:9 и 32:9
  { name: 'ultra-2560', width: 2560, height: 950, quick: true },
  { name: 'ultra-3440', width: 3440, height: 1310 },
  { name: 'ultra-3840', width: 3840, height: 950 },
  { name: 'ultra-5120', width: 5120, height: 1310, quick: true },
  // Портретные мониторы
  { name: 'portrait-1080', width: 1080, height: 1800 },
  { name: 'portrait-1440', width: 1440, height: 2420, quick: true },
  { name: 'portrait-2160', width: 2160, height: 3700 },
];
