// Реестр иконок интерфейса: имя → контур. Иконки линейные — контур рисуется обводкой цветом текста
// (fill: none, stroke: currentColor, скруглённые концы; компонент Icon). Мелкие (кнопки, чипы) — в
// сетке 16 × 16, крупные — 24 × 24; толщина обводки по умолчанию подобрана под сетку. Иллюстрации
// (карты, логотип, лица настроений, аватары) сюда не входят — это не иконки.
const small = (body) => ({ viewBox: '0 0 16 16', strokeWidth: 1.8, body });
const large = (body) => ({ viewBox: '0 0 24 24', strokeWidth: 1.7, body });
const path = (d) => <path d={d} />;

export const GLYPHS = {
  // Действия и навигация
  close: small(path('M3 3l10 10M13 3L3 13')),
  check: small(path('M3 8.5l3 3 7-7')),
  'chevron-left': small(path('M10 3.5 5.5 8l4.5 4.5')),
  'chevron-right': small(path('M6 3l5 5-5 5')),
  'chevron-down': small(path('M4 6l4 4 4-4')),
  link: small(
    path(
      'M6.5 9.5l3-3M7 4.5l1.3-1.3a2.8 2.8 0 0 1 4 4L11 8.5M9 11.5l-1.3 1.3a2.8 2.8 0 0 1-4-4L5 7.5',
    ),
  ),
  lock: small(path('M4 7V5a4 4 0 0 1 8 0v2M3 7h10v7H3z')),
  place: small(
    path(
      'M8 14s-4.5-4.2-4.5-7.8a4.5 4.5 0 0 1 9 0C12.5 9.8 8 14 8 14zM8 8a1.7 1.7 0 1 0 0-3.4A1.7 1.7 0 0 0 8 8z',
    ),
  ),
  filter: small(path('M2 4h12M4.5 8h7M7 12h2')),
  swap: small(path('M3 5h9l-2.5-2.5M13 11H4l2.5 2.5')),
  stats: small(path('M2.5 13.5h11M4.5 11V7.5M8 11V4M11.5 11V6')),
  plus: large(path('M12 5v14M5 12h14')),
  recenter: large(path('M12 3v3M12 18v3M3 12h3M18 12h3M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z')),
  'arrow-right': large(path('M5 12h14m-5-5 5 5-5 5')),
  search: large(path('M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm5-2 4 4')),
  paperclip: large(
    path(
      'm20 11.5-8 8a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L9.7 17.2a1.7 1.7 0 0 1-2.4-2.4L15 7.2',
    ),
  ),
  done: large(path('m5 12.5 4.5 4.5L19 7.5')),
  camera: large(
    <>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </>,
  ),
  eye: large(
    <>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>,
  ),
  'eye-off': large(
    <>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      <path d="M4 20L20 4" />
    </>,
  ),
  bell: large(
    path(
      'M12 21a2.5 2.5 0 0 0 2.5-2.5h-5A2.5 2.5 0 0 0 12 21zM5 16.5h14l-1.8-2.4V10a5.2 5.2 0 0 0-10.4 0v4.1z',
    ),
  ),
  pin: large(
    path(
      'M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
    ),
  ),

  // Разделы (меню телефона, темы помощи, плюсы аккаунта)
  map: large(path('M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20V6.5ZM9 4v13.5M15 6.5V20')),
  chart: large(path('M4 20h16M7 16v-5M12 16V7M17 16v-8')),
  info: large(path('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5v.5')),
  headset: large(path('M4 12a8 8 0 0 1 16 0v4a2 2 0 0 1-2 2h-1v-6h3M4 12v4a2 2 0 0 0 2 2h1v-6H4')),
  sliders: large(path('M4 7h9M17 7h3M15 5v4M4 17h3M11 17h9M9 15v4')),
  user: large(path('M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8c0-3.3 3.1-6 7-6s7 2.7 7 6')),
  smile: large(
    path('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8.5 14.5c1.9 1.6 5.1 1.6 7 0M9 9.5h.01M15 9.5h.01'),
  ),
  'pin-alert': large(
    path('M12 21s-6.5-5.4-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.6 12 21 12 21Zm0-13.5v3.5M12 14h.01'),
  ),
  shield: large(path('M12 3 5 6v5.5c0 4.3 3 7.9 7 9.5 4-1.6 7-5.2 7-9.5V6l-7-3Zm-2.8 9 2 2 4-4')),
  wrench: large(
    path(
      'M14.7 6.3a4 4 0 0 0-5.4 5.4L3.5 17.5l3 3 5.8-5.8a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4 2.6-2.6Z',
    ),
  ),
  padlock: large(path('M6 11V8a6 6 0 0 1 12 0v3M5 11h14v10H5z')),

  // Приватность («Как это работает»)
  mask: large(
    path(
      'M4 12c0-4 3.6-7 8-7s8 3 8 7-3.6 7-8 7-8-3-8-7Zm4.5-1.5h2M13.5 10.5h2M9 15c1.8 1.2 4.2 1.2 6 0',
    ),
  ),
  crowd: large(
    path(
      'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 20c0-3 2.7-5 6-5s6 2 6 5M14 15.3c.6-.2 1.3-.3 2-.3 3.3 0 6 2 6 5',
    ),
  ),
  'photo-off': large(
    path('M4 8h3l2-3h6l2 3h3v11H4V8Zm8 8.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM3 3l18 18'),
  ),

  // Уведомления
  'users-check': large(
    path('M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 19c0-3 2.7-5 6-5s6 2 6 5M15.5 11l1.8 1.8L21 9'),
  ),
  'pin-check': large(
    path('M12 21s-6.5-5.4-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.6 12 21 12 21zM9.5 10l2 2 3.5-3.5'),
  ),
  'check-circle': large(path('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12.5l2.7 2.7L16.5 9.5')),
  ban: large(path('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM5.6 5.6l12.8 12.8')),
  'bell-large': {
    viewBox: '0 0 48 48',
    strokeWidth: 1.6,
    body: path('M24 40a4 4 0 0 0 4-4h-8a4 4 0 0 0 4 4zM12 32h24l-3-4v-8a9 9 0 0 0-18 0v8z'),
  },

  // Тема и время суток
  sun: large(
    path(
      'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
    ),
  ),
  moon: large(path('M20 14.2A8.5 8.5 0 0 1 9.8 4a8.5 8.5 0 1 0 10.2 10.2z')),
  sunrise: large(path('M3 17h18M7 17a5 5 0 0 1 10 0M12 5v3M5.6 9.6l1.8 1.8M18.4 9.6l-1.8 1.8')),
  sunset: large(path('M3 17h18M7 17a5 5 0 0 1 10 0M12 11V5l-2.5 2.5M12 5l2.5 2.5')),

  // Категории проблем
  trash: large(
    <>
      <path d="M5 7h14M9 7V5h6v2M7 7l1 12h8l1-12" />
      <path d="M10 10v6M14 10v6" />
    </>,
  ),
  car: large(
    <>
      <path d="M5 16V11l2-4h10l2 4v5H5z" />
      <circle cx="8" cy="16.5" r="1.5" />
      <circle cx="16" cy="16.5" r="1.5" />
    </>,
  ),
  road: large(
    <>
      <path d="M8 4L5 20M16 4l3 16M12 5v2M12 10v2" />
      <path d="M10.5 15l1.5 1.5 1.5-1 1 2" />
    </>,
  ),
  streetlight: large(
    <>
      <path d="M8 21h8M12 21V9" />
      <path d="M8 9h8l-1.5-4h-5L8 9z" />
      <path d="M12 12v0" />
    </>,
  ),
  speaker: large(
    <>
      <path d="M4 10v4h3l4 3V7L7 10H4z" />
      <path d="M15 9a4 4 0 0 1 0 6M17.5 6.5a7.5 7.5 0 0 1 0 11" />
    </>,
  ),
  bottle: large(
    <>
      <path d="M10 3h4v4l1.5 2.5V20h-7V9.5L10 7V3z" />
      <path d="M8.5 13h7" />
    </>,
  ),
  bus: large(
    <>
      <rect x="5" y="4" width="14" height="13" rx="2" />
      <path d="M5 11h14M8 20v-3M16 20v-3" />
    </>,
  ),
  tree: large(
    <>
      <path d="M12 20v-6" />
      <path d="M12 3c4 2 5 6 3 9H9C7 9 8 5 12 3z" />
    </>,
  ),
  dots: large(
    <>
      <circle cx="6" cy="12" r="1.3" />
      <circle cx="12" cy="12" r="1.3" />
      <circle cx="18" cy="12" r="1.3" />
    </>,
  ),
};
