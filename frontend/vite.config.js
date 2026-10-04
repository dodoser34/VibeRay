import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { languagePages } from './plugins/languagePages.js';

// Геоданные городов (.geojson) хранятся отформатированными для чтения, а в сборку попадают сжатыми —
// как обычный JSON-модуль, без отступов.
function geojson() {
  return {
    name: 'viberay-geojson',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('.geojson')) return null;
      const compact = JSON.stringify(JSON.parse(code));
      return { code: `export default JSON.parse(${JSON.stringify(compact)});`, map: null };
    },
  };
}

export default defineConfig({
  // На GitHub Pages сайт живёт в подпапке (/<репозиторий>/) — её передаёт workflow деплоя.
  base: process.env.VITE_BASE || '/',
  plugins: [
    geojson(),
    react(),
    // SITE_URL — адрес сайта с подпапкой (передаёт workflow деплоя): для hreflang и sitemap.xml.
    languagePages({
      root: fileURLToPath(new URL('.', import.meta.url)),
      siteUrl: process.env.SITE_URL,
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        // Библиотеки — отдельными файлами: меняются редко и остаются в кэше браузера между
        // обновлениями сайта; three.js грузится только страницами с 3D.
        codeSplitting: {
          groups: [
            { name: 'three', test: /node_modules\/three\// },
            { name: 'react', test: /node_modules\/(react|react-dom|react-router|scheduler)\// },
            { name: 'gsap', test: /node_modules\/(gsap|@gsap)\// },
          ],
        },
      },
    },
  },
  server: {
    port: Number(process.env.PORT) || 5173,
    // Для режима с бэкендом (VITE_USE_MOCKS=false): запросы /api уходят на локальный FastAPI.
    proxy: { '/api': 'http://localhost:8000' },
  },
});
