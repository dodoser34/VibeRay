import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

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
  plugins: [geojson(), react()],
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
