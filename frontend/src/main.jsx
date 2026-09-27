import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { AuthProvider } from '@/features/auth';
import { trackInputModality } from '@/app/inputModality';
import { router } from '@/app/router';
import '@/shared/animations/gsapSetup';
import '@/styles/tokens.css';
import '@/styles/reset.css';
import '@/styles/global.css';
// Последними: адаптации стилей компонентов под устройства (src/adaptations/README.md)
import '@/adaptations/index.css';

trackInputModality();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
);
