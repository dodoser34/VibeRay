import { createBrowserRouter } from 'react-router';
import { App } from './App';

// Страницы грузятся по требованию: на «Поддержку» не нужно качать three.js и сцену карты.
const PAGES = {
  home: () => import('@/pages/HomePage/HomePage'),
  map: () => import('@/pages/MapPage/MapPage'),
  about: () => import('@/pages/AboutPage/AboutPage'),
  support: () => import('@/pages/SupportPage/SupportPage'),
  settings: () => import('@/pages/SettingsPage/SettingsPage'),
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

export const router = createBrowserRouter(
  [
    {
      element: <App />,
      hydrateFallbackElement: null,
      children: [
        // Один экземпляр HomePage на все три пути, чтобы карточка-пропуск переворачивалась, а не
        // монтировалась заново.
        {
          path: '/',
          ...page('home', 'HomePage'),
          children: [{ path: 'login' }, { path: 'register' }],
        },
        { path: '/map/:citySlug', ...page('map', 'MapPage') },
        { path: '/map/:citySlug/district/:districtSlug', ...page('map', 'MapPage') },
        { path: '/map/:citySlug/problem/:problemId', ...page('map', 'MapPage') },
        { path: '/map/:citySlug/stats', ...page('map', 'MapPage', { view: 'stats' }) },
        { path: '/about', ...page('about', 'AboutPage') },
        { path: '/support', ...page('support', 'SupportPage') },
        { path: '/settings', ...page('settings', 'SettingsPage') },
        { path: '*', ...page('notFound', 'NotFoundPage') },
      ],
    },
  ],
  // На GitHub Pages приложение лежит в подпапке репозитория (vite.config.js → base).
  { basename: import.meta.env.BASE_URL },
);
