// Состояния сайта для проверки вёрстки. Путь — без языкового префикса (его добавляет session.js).
// role: guest — каждое состояние открывается заново по адресу; resident / moderator — вход один раз
// через демо-подсказку на форме входа, дальше переходы внутри приложения (токен живёт только в памяти).
// scrolls — доли прокрутки страницы (история «О проекте» прокручивается по главам); pause — сколько ждать
// анимаций появления, мс (главная: передний слой, карточка входа, девушка; карта: перелёт камеры к
// району или проблеме).
export const STATES = [
  { name: 'home-login', role: 'guest', path: '/login', pause: 6000 },
  { name: 'home-register', role: 'guest', path: '/register', pause: 6000 },
  { name: 'map', role: 'guest', path: '/map/kostanay' },
  { name: 'map-district', role: 'guest', path: '/map/kostanay/district/center', pause: 4000 },
  { name: 'map-problem', role: 'guest', path: '/map/kostanay/problem/p1', pause: 4000 },
  { name: 'map-stats', role: 'guest', path: '/map/kostanay/stats' },
  { name: 'about', role: 'guest', path: '/about', scrolls: [0, 0.2, 0.45, 0.7, 0.95] },
  { name: 'support', role: 'guest', path: '/support' },
  { name: 'not-found', role: 'guest', path: '/missing-page' },
  { name: 'resident-district', role: 'resident', path: '/map/kostanay/district/center' },
  { name: 'resident-problem', role: 'resident', path: '/map/kostanay/problem/p1' },
  { name: 'resident-settings', role: 'resident', path: '/settings' },
  { name: 'moderation-queue', role: 'moderator', path: '/moderation' },
  { name: 'moderation-map', role: 'moderator', path: '/moderation/map' },
  { name: 'moderation-city', role: 'moderator', path: '/moderation/city' },
  { name: 'moderation-support', role: 'moderator', path: '/moderation/support' },
  { name: 'moderation-settings', role: 'moderator', path: '/moderation/settings' },
];

// Номер демо-аккаунта в подсказке формы входа (src/demo-data/demoLogin.js)
export const DEMO_ACCOUNT = { resident: 0, moderator: 1 };

// Верхнеуровневые слои поверх страницы: не должны выходить за окно и пересекаться друг с другом.
export const OVERLAYS = [
  '[data-ui="map-panel-left"]',
  '[data-ui="map-detail"]',
  '[data-ui="map-overview"]',
  '[data-ui="map-toast"]',
  '[data-ui="map-action-bar"]',
  '[data-ui="map-corner"]',
  '[data-ui="moderation-map-detail"]',
  '[data-ui="moderation-map-filters"]',
];

// Плавающие окна поверх всего: должны помещаться в окно, но перекрывать страницу им можно.
export const FLOATING = [
  '[data-ui="notification-popover"]',
  '[data-ui="coach-card"]',
  '[data-ui="modal-panel"]',
];

// Кнопки внутри нарисованного экрана телефона в истории «О проекте» — демонстрация приложения в
// уменьшенном макете; размер тач-цели к ним не применяется (настоящие элементы управления — проверяются).
export const TOUCH_EXEMPT = ['[data-ui="story-overlay"][data-variant="phone"]'];

// Где многоточие — осознанное решение (пользовательские данные: никнейм, имя файла).
export const ELLIPSIS_ALLOWED = [
  '[data-ui="tabbar-nickname"]',
  // Превью описания в очереди модератора — две строки, полностью — в карточке проблемы
  '[data-ui="moderation-item"] p',
];

// Объекты 3D-сцены (значки кластеров): у края кадра их срезает граница холста, как и сам город, —
// это не текст интерфейса, обрезка для них не проверяется.
export const SCENE_OBJECTS = ['[data-ui="map-cluster"]'];
