import { createBrowserRouter } from 'react-router';
import { LANGUAGES, localizePath } from '@/shared/lib/language';
import { App } from './App';

// Страницы грузятся по требованию: на «Поддержку» не нужно качать three.js и сцену карты.
const PAGES = {
  home: () => import('@/pages/HomePage/HomePage'),
  map: () => import('@/pages/MapPage/MapPage'),
  about: () => import('@/pages/AboutPage/AboutPage'),
  support: () => import('@/pages/SupportPage/SupportPage'),
  settings: () => import('@/pages/SettingsPage/SettingsPage'),
  moderation: () => import('@/pages/ModerationPage/ModerationPage'),
  moderationMap: () => import('@/pages/ModerationMapPage/ModerationMapPage'),
  notFound: () => import('@/pages/NotFoundPage/NotFoundPage'),
};

// element, а не Component: маршруты карты (город, район, проблема, статистика) рендерят один и тот
// же MapPage, и при переходе между ними страница не монтируется заново.
const page = (key, name, props = {}) => ({
  lazy: async () => {
    const Page = (await PAGES[key]())[name];
    return { element: <Page {...props} /> };
  },
});

// Фоном подгружает остальные страницы, чтобы переходы не ждали сети (только при хорошем соединении).
export function prefetchPages() {
  Object.values(PAGES).forEach((load) => load());
}

// Одни и те же страницы на каждом языке: русский — без префикса, остальные — /kk, /en, /de
// (shared/lib/language.js). Маршруты одной глубины, поэтому при смене языка страница не
// монтируется заново — меняются только адрес и тексты.
const pagesFor = (prefix) => [
  // Один экземпляр HomePage на все три пути, чтобы карточка-пропуск переворачивалась, а не
  // монтировалась заново.
  {
    path: prefix || '/',
    ...page('home', 'HomePage'),
    children: [{ path: 'login' }, { path: 'register' }],
  },
  { path: `${prefix}/map/:citySlug`, ...page('map', 'MapPage') },
  { path: `${prefix}/map/:citySlug/district/:districtSlug`, ...page('map', 'MapPage') },
  { path: `${prefix}/map/:citySlug/problem/:problemId`, ...page('map', 'MapPage') },
  { path: `${prefix}/map/:citySlug/stats`, ...page('map', 'MapPage', { view: 'stats' }) },
  { path: `${prefix}/about`, ...page('about', 'AboutPage') },
  { path: `${prefix}/support`, ...page('support', 'SupportPage') },
  { path: `${prefix}/settings`, ...page('settings', 'SettingsPage') },
  // Разделы модератора — свой интерфейс (app/useRoleRoute.js); настройки — та же страница настроек.
  { path: `${prefix}/moderation`, ...page('moderation', 'ModerationPage', { section: 'queue' }) },
  { path: `${prefix}/moderation/map`, ...page('moderationMap', 'ModerationMapPage') },
  {
    path: `${prefix}/moderation/city`,
    ...page('moderation', 'ModerationPage', { section: 'city' }),
  },
  {
    path: `${prefix}/moderation/support`,
    ...page('moderation', 'ModerationPage', { section: 'support' }),
  },
  { path: `${prefix}/moderation/settings`, ...page('settings', 'SettingsPage') },
];

export const router = createBrowserRouter(
  [
    {
      element: <App />,
      hydrateFallbackElement: null,
      children: [
        ...LANGUAGES.flatMap((code) => pagesFor(localizePath('', code))),
        { path: '*', ...page('notFound', 'NotFoundPage') },
      ],
    },
  ],
  // На GitHub Pages приложение лежит в подпапке репозитория (vite.config.js → base).
  { basename: import.meta.env.BASE_URL },
);
