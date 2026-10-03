// Первым: язык интерфейса подставляется в тексты до того, как их прочитают остальные модули
import '@/shared/lib/language';
import '@/shared/lib/theme';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { AuthProvider } from '@/features/auth';
import { NotificationsProvider } from '@/features/notifications';
import { trackInputModality } from '@/app/inputModality';
import { prefetchPages, router } from '@/app/router';
import { canPrefetch, isLiteGraphics } from '@/adaptations/core';
import '@/shared/animations/gsapSetup';
import '@/styles/tokens.css';
import '@/styles/themes/dark.css';
import '@/styles/themes/light.css';
import '@/styles/reset.css';
import '@/styles/global.css';
// Последними: адаптации стилей компонентов под устройства (src/adaptations/README.md)
import '@/adaptations/index.css';

trackInputModality();

// После загрузки, когда браузер свободен, — остальные страницы в кэш (не на медленной сети и не в
// лёгком режиме графики: там 3D-страницы лишняя нагрузка).
window.addEventListener(
  'load',
  () => {
    if (!canPrefetch() || isLiteGraphics()) return;
    const idle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 1500));
    idle(prefetchPages);
  },
  { once: true },
);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <NotificationsProvider>
        <RouterProvider router={router} />
      </NotificationsProvider>
    </AuthProvider>
  </StrictMode>,
);
