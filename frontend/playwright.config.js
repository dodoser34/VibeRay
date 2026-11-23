import { defineConfig } from '@playwright/test';

// Проверка вёрстки на матрице окон и языков (e2e/layout). Браузер — установленный Chrome, без
// скачивания. Сайт собирается в отдельную папку с VITE_LAYOUT_TEST=1 (включает псевдоязык ?pseudo=long)
// и раздаётся vite preview. LAYOUT_URL — проверять уже запущенный сервер (например, npm run dev).
const PORT = 4173;
const OUT_DIR = 'e2e/output/dist';

export default defineConfig({
  testDir: './e2e/layout',
  outputDir: './e2e/output/test-results',
  timeout: 10 * 60_000,
  fullyParallel: true,
  workers: Number(process.env.LAYOUT_WORKERS) || 4,
  reporter: [['list']],
  globalSetup: './e2e/layout/setup.js',
  globalTeardown: './e2e/layout/report.js',
  use: {
    baseURL: process.env.LAYOUT_URL || `http://localhost:${PORT}`,
    channel: 'chrome',
    headless: true,
  },
  projects: [
    { name: 'quick', testMatch: 'layout.quick.spec.js' },
    { name: 'full', testMatch: 'layout.full.spec.js' },
  ],
  webServer: process.env.LAYOUT_URL
    ? undefined
    : {
        command: `npx vite build --outDir ${OUT_DIR} && npx vite preview --outDir ${OUT_DIR} --port ${PORT} --strictPort`,
        url: `http://localhost:${PORT}`,
        env: { VITE_LAYOUT_TEST: '1' },
        reuseExistingServer: true,
        timeout: 300_000,
      },
});
