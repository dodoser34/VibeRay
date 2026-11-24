import { DEMO_ACCOUNT } from './states.js';

// pseudo — английский с удлинёнными строками (?pseudo=long, src/shared/lib/i18n/pseudoLanguage.js)
export function urlFor(language, path) {
  if (language === 'en') return path;
  if (language === 'pseudo') return `${path}?pseudo=long`;
  return path === '/' ? `/${language}` : `/${language}${path}`;
}

// Страница успокоилась: сеть стихла, шрифты на месте, анимации появления доиграли.
export async function settle(page, pauseMs = 1600) {
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => null);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(pauseMs);
}

// Переход внутри приложения без перезагрузки: React Router слушает popstate и читает адрес. Пауза —
// на переход «бумажная карта» и перелёт камеры к району, чтобы снимок был уже в покое.
export async function navigateInApp(page, url) {
  await page.evaluate((target) => {
    window.history.pushState({}, '', target);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, url);
  await settle(page, 4000);
}

export async function scrollToFraction(page, fraction) {
  await page.evaluate((share) => {
    const max = document.scrollingElement.scrollHeight - window.innerHeight;
    window.scrollTo(0, Math.round(max * share));
  }, fraction);
  await settle(page, 1400);
}

// Вход демо-аккаунтом: кнопка «Подставить» в демо-подсказке и отправка формы.
export async function login(page, language, role) {
  await page.goto(urlFor(language, '/login'));
  await settle(page);
  const card = page.locator('[data-ui="auth-card"]');
  await card.locator('li button').nth(DEMO_ACCOUNT[role]).click();
  await card.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 30_000 });
  await settle(page);
}
