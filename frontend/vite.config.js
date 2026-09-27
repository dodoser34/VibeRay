import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // На GitHub Pages сайт живёт в подпапке (/<репозиторий>/) — её передаёт workflow деплоя.
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: Number(process.env.PORT) || 5173,
    // Для режима с бэкендом (VITE_USE_MOCKS=false): запросы /api уходят на локальный FastAPI.
    proxy: { '/api': 'http://localhost:8000' },
  },
});
