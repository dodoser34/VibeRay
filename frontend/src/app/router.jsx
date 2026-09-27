import { createBrowserRouter, Navigate } from 'react-router';
import { HomePage } from '@/pages/HomePage/HomePage';
import { MapPage } from '@/pages/MapPage/MapPage';
import { AboutPage } from '@/pages/AboutPage/AboutPage';
import { SupportPage } from '@/pages/SupportPage/SupportPage';
import { SettingsPage } from '@/pages/SettingsPage/SettingsPage';
import { App } from './App';

export const router = createBrowserRouter(
  [
    {
      element: <App />,
      children: [
        // Один экземпляр HomePage на все три пути, чтобы карточка-пропуск переворачивалась, а не
        // монтировалась заново.
        {
          path: '/',
          element: <HomePage />,
          children: [{ path: 'login' }, { path: 'register' }],
        },
        { path: '/map/:citySlug', element: <MapPage /> },
        { path: '/map/:citySlug/district/:districtSlug', element: <MapPage /> },
        { path: '/map/:citySlug/stats', element: <MapPage view="stats" /> },
        { path: '/about', element: <AboutPage /> },
        { path: '/support', element: <SupportPage /> },
        { path: '/settings', element: <SettingsPage /> },
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
  ],
  // На GitHub Pages приложение лежит в подпапке репозитория (vite.config.js → base).
  { basename: import.meta.env.BASE_URL },
);
