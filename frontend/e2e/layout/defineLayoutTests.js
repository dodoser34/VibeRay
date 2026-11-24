import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { auditLayout } from './audit.js';
import { login, navigateInApp, scrollToFraction, settle, urlFor } from './session.js';
import {
  ELLIPSIS_ALLOWED,
  FLOATING,
  OVERLAYS,
  SCENE_OBJECTS,
  STATES,
  TOUCH_EXEMPT,
} from './states.js';
import { VIEWPORTS } from './viewports.js';

const OUTPUT = new URL('../output/', import.meta.url);
const MIN_TARGET = 44;

// Фильтры для работы над конкретным местом: LAYOUT_VIEWPORTS=phone,ultra LAYOUT_LANGS=de
// LAYOUT_STATES=map — подстроки имён через запятую.
const filterBy = (items, variable, nameOf) => {
  const wanted = process.env[variable]?.split(',').filter(Boolean);
  return wanted
    ? items.filter((item) => wanted.some((part) => nameOf(item).includes(part)))
    : items;
};

const LANGUAGES = { quick: ['en', 'de'], full: ['en', 'ru', 'kk', 'de', 'pseudo'] };

// Тест — «окно × язык × роль»: вход один раз, дальше состояния роли по очереди. Каждое состояние —
// скриншот и аудит; нарушения пишутся в e2e/output/issues/ (сводку собирает report.js).
export function defineLayoutTests(set) {
  const viewports = filterBy(
    VIEWPORTS.filter((viewport) => set === 'full' || viewport.quick),
    'LAYOUT_VIEWPORTS',
    (viewport) => viewport.name,
  );
  const languages = filterBy(LANGUAGES[set], 'LAYOUT_LANGS', (language) => language);
  const states = filterBy(STATES, 'LAYOUT_STATES', (state) => state.name);
  const roles = [...new Set(states.map((state) => state.role))];

  test.describe.configure({ mode: 'parallel' });

  for (const viewport of viewports) {
    for (const language of languages) {
      for (const role of roles) {
        const roleStates = states.filter((state) => state.role === role);
        test(`${viewport.name} ${language} ${role}`, async ({ browser }) => {
          const context = await browser.newContext({
            viewport: { width: viewport.width, height: viewport.height },
            hasTouch: Boolean(viewport.touch),
            isMobile: Boolean(viewport.touch),
            locale: 'en-US',
          });
          const page = await context.newPage();
          if (role !== 'guest') await login(page, language, role);

          const issues = [];
          for (const state of roleStates) {
            const url = urlFor(language, state.path);
            if (role === 'guest') {
              await page.goto(url);
              await settle(page, state.pause);
            } else {
              await navigateInApp(
                page,
                urlFor(language === 'pseudo' ? 'en' : language, state.path),
              );
            }
            for (const fraction of state.scrolls ?? [null]) {
              if (fraction !== null) await scrollToFraction(page, fraction);
              const shot = fraction === null ? state.name : `${state.name}-${fraction * 100}`;
              const folder = new URL(`screens/${viewport.name}/${language}/`, OUTPUT);
              mkdirSync(folder, { recursive: true });
              await page.screenshot({
                path: fileURLToPath(new URL(`${shot}.jpg`, folder)),
                type: 'jpeg',
                quality: 70,
              });
              const found = await page.evaluate(auditLayout, {
                ellipsisAllowed: ELLIPSIS_ALLOWED,
                overlays: OVERLAYS,
                floating: FLOATING,
                touch: Boolean(viewport.touch),
                touchExempt: TOUCH_EXEMPT,
                sceneObjects: SCENE_OBJECTS,
                minTarget: MIN_TARGET,
              });
              issues.push(
                ...found.map((issue) => ({
                  ...issue,
                  viewport: viewport.name,
                  language,
                  state: shot,
                })),
              );
            }
          }
          await context.close();

          const issuesFolder = new URL('issues/', OUTPUT);
          mkdirSync(issuesFolder, { recursive: true });
          const file = new URL(`${viewport.name}-${language}-${role}.json`, issuesFolder);
          writeFileSync(file, JSON.stringify(issues, null, 2));

          const errors = issues.filter((issue) => issue.severity === 'error');
          expect
            .soft(
              errors.map(
                (issue) => `${issue.state}: ${issue.type} ${issue.target} «${issue.text}»`,
              ),
            )
            .toEqual([]);
        });
      }
    }
  }
}
