// Язык интерфейса: английский (основной, src/texts/en) и русский, казахский, немецкий
// (src/texts/{ru,kk,de} с теми же ключами). Код импортирует английские JSON, а этот модуль
// записывает в эти же объекты значения нужного языка — на месте, не меняя ссылок на вложенные
// объекты и массивы. Перевод каждого языка — отдельный файл сборки (translations/<язык>.js), он
// скачивается, только когда язык нужен. main.jsx импортирует модуль первым и рисует страницу после
// languageReady.
// Смена языка на лету — applyLanguage(): тексты переписываются, подписчики (useLanguage)
// перерисовываются, запросы к API повторяются. Поэтому подписи справочников — геттеры
// (shared/config/withLabels.js), тексты не копируются в константы модулей, а элементы под SplitText
// получают key={language}, иначе React не обновит их текст.
// У каждого языка свой адрес: английский — без префикса (/map/kostanay), остальные — с ним
// (/ru/map/kostanay). Маршруты и ссылки работают с путями без префикса, а localizePath()
// добавляет его (app/routing/useLanguageRoute.js держит адрес и язык согласованными).

import about from '@/texts/en/about.json';
import auth from '@/texts/en/auth.json';
import common from '@/texts/en/common.json';
import dictionaries from '@/texts/en/dictionaries.json';
import errors from '@/texts/en/errors.json';
import home from '@/texts/en/home.json';
import map from '@/texts/en/map.json';
import moderation from '@/texts/en/moderation.json';
import mood from '@/texts/en/mood.json';
import nav from '@/texts/en/nav.json';
import notFound from '@/texts/en/notFound.json';
import notifications from '@/texts/en/notifications.json';
import problems from '@/texts/en/problems.json';
import settings from '@/texts/en/settings.json';
import stats from '@/texts/en/stats.json';
import support from '@/texts/en/support.json';
import transition from '@/texts/en/transition.json';
import { createListeners } from '../listeners';
import { readChoice, writeValue } from '../localPreferences';

export const LANGUAGES = ['en', 'ru', 'kk', 'de'];
export const DEFAULT_LANGUAGE = 'en';
const LOCALES = { ru: 'ru-RU', kk: 'kk-KZ', en: 'en-GB', de: 'de-DE' };
const PREFIXED = LANGUAGES.filter((code) => code !== DEFAULT_LANGUAGE);
const STORAGE_KEY = 'viberay.language';
// Подпапка сайта (GitHub Pages): пути приложения — после неё.
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

// Исходные тексты — теми же импортами, что и в остальном коде (тот же экземпляр модуля, в том числе
// в dev после правок). Новый файл в src/texts нужно добавить и сюда.
const texts = {
  about,
  auth,
  common,
  dictionaries,
  errors,
  home,
  map,
  moderation,
  mood,
  nav,
  notFound,
  notifications,
  problems,
  settings,
  stats,
  support,
  transition,
};
const translations = {};
// Перевод каждого языка — один файл сборки (translations/<язык>.js). Новый язык добавляется и сюда.
const LOADERS = {
  en: () => import('./translations/en.js'),
  ru: () => import('./translations/ru.js'),
  kk: () => import('./translations/kk.js'),
  de: () => import('./translations/de.js'),
};
const sectionOf = (path) => path.slice(path.lastIndexOf('/') + 1, -'.json'.length);
const loading = {};

// Перевод языка — один раз; при ошибке сети следующая попытка загрузит заново.
export function loadLanguage(code) {
  if (translations[code]) return Promise.resolve();
  loading[code] ??= LOADERS[code]()
    .then(({ default: files }) => {
      // Копия: английские файлы — те же объекты, в которые переписывается текущий язык.
      translations[code] = Object.fromEntries(
        Object.entries(files).map(([path, section]) => [sectionOf(path), structuredClone(section)]),
      );
      if (import.meta.env.DEV) {
        Object.keys(translations[code])
          .filter((section) => !(section in texts))
          .forEach((section) => console.warn(`[texts] ${section}.json не подключён в language.js`));
      }
    })
    .catch((error) => {
      delete loading[code];
      throw error;
    });
  return loading[code];
}

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

// Значения языка — поверх текущих, на месте: объекты и массивы остаются теми же, меняются строки.
function overlay(target, source, path) {
  Object.entries(source).forEach(([key, value]) => {
    const current = target[key];
    if (isObject(value) && isObject(current)) overlay(current, value, `${path}.${key}`);
    else if (Array.isArray(value) && Array.isArray(current)) {
      current.length = value.length;
      value.forEach((item, i) => {
        if (isObject(item) && isObject(current[i]))
          overlay(current[i], item, `${path}.${key}[${i}]`);
        else current[i] = structuredClone(item);
      });
    } else target[key] = structuredClone(value);
  });
  if (import.meta.env.DEV) {
    Object.keys(target)
      .filter((key) => !(key in source))
      .forEach((key) => console.warn(`[texts] нет перевода: ${path}.${key}`));
  }
}

function applyTexts(next) {
  Object.entries(texts).forEach(([section, target]) => {
    const source = translations[next][section];
    if (source) overlay(target, source, section);
    else if (import.meta.env.DEV)
      console.warn(`[texts] нет файла перевода: ${next}/${section}.json`);
  });
}

// Пути — относительно подпапки сайта, как их видит роутер: '/ru/about' → 'ru'.
export function languageOfPath(pathname) {
  const first = pathname.split('/')[1];
  return PREFIXED.includes(first) ? first : DEFAULT_LANGUAGE;
}

// '/ru/about' → '/about', '/ru' → '/'.
export function stripLanguage(pathname) {
  const code = languageOfPath(pathname);
  return code === DEFAULT_LANGUAGE ? pathname : pathname.slice(code.length + 1) || '/';
}

// Путь страницы на нужном языке: '/about' → '/ru/about'. Принимает путь без префикса языка.
export function localizePath(path, code = language) {
  if (code === DEFAULT_LANGUAGE) return path;
  return path === '/' ? `/${code}` : `/${code}${path}`;
}

// Поисковый робот (и автотест) видит адрес как есть: по каждому адресу — ровно его версия, иначе
// поисковик не проиндексирует английскую.
const isRobot = () =>
  navigator.webdriver || /bot|crawl|spider|slurp|headless|lighthouse/i.test(navigator.userAgent);

// Язык браузера посетителя: первый из его списка, который есть на сайте, иначе — английский.
function browserLanguage() {
  if (isRobot()) return null;
  const preferred = (navigator.languages?.length ? navigator.languages : [navigator.language])
    .filter(Boolean)
    .map((tag) => tag.slice(0, 2).toLowerCase());
  if (!preferred.length) return null;
  return preferred.find((code) => LANGUAGES.includes(code)) ?? DEFAULT_LANGUAGE;
}

// Язык — из адреса. Старые ссылки с ?lang= переводятся на адрес с префиксом, старые английские
// с префиксом /en/ — на адрес без него. Адрес без префикса — английская версия для поисковиков,
// а человек попадает на свою: язык, который он выбирал раньше, иначе — язык его браузера.
function detect() {
  const url = new URL(window.location.href);
  let path = url.pathname.startsWith(BASE) ? url.pathname.slice(BASE.length) || '/' : url.pathname;
  if (path.split('/')[1] === DEFAULT_LANGUAGE) {
    path = path.slice(DEFAULT_LANGUAGE.length + 1) || '/';
    url.pathname = BASE + path;
    window.history.replaceState(window.history.state, '', url);
  }
  const fromPath = languageOfPath(path);
  const fromQuery = url.searchParams.get('lang');
  url.searchParams.delete('lang');
  let next = fromPath;
  if (LANGUAGES.includes(fromQuery)) next = fromQuery;
  else if (fromPath === DEFAULT_LANGUAGE)
    next = readChoice(STORAGE_KEY, LANGUAGES) ?? browserLanguage() ?? fromPath;
  if (next !== fromPath || fromQuery !== null) {
    url.pathname = BASE + localizePath(stripLanguage(path), next);
    window.history.replaceState(window.history.state, '', url);
  }
  return next;
}

// Язык страницы и описание для поисковиков — на языке интерфейса.
function applyDocument() {
  document.documentElement.lang = language;
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute('content', common.meta.description);
}

let language = detect();
document.documentElement.lang = language;

// Тексты языка из адреса на месте — можно рисовать страницу (main.jsx). Английский загружается
// первым, пока в общих объектах ещё английские тексты: к нему можно вернуться после другого языка.
// Не загрузился перевод (нет сети) — страница рисуется по-английски, а не остаётся пустой.
export const languageReady = loadLanguage(DEFAULT_LANGUAGE)
  .then(() => language !== DEFAULT_LANGUAGE && loadLanguage(language))
  .then(() => language !== DEFAULT_LANGUAGE && applyTexts(language))
  .catch((error) => console.error('[texts] перевод не загрузился', error));
languageReady.then(applyDocument);

const listeners = createListeners();
let pendingWork = [];

export function getLanguage() {
  return language;
}

// Локаль для Intl (даты, числа, сортировка).
export function getLocale() {
  return LOCALES[language];
}

export const subscribeLanguage = listeners.subscribe;

// Тексты — на новом языке, как только перевод загружен; подписчики перерисовываются. Плавную смену
// делает shared/animations/languageChange/languageTransition.js.
export async function applyLanguage(next) {
  if (next === language || !LANGUAGES.includes(next)) return;
  await loadLanguage(next);
  language = next;
  applyTexts(next);
  applyDocument();
  writeValue(STORAGE_KEY, next);
  listeners.notify();
}

// Работа, которую смена языка запустила (повторные запросы к API): переход ждёт её, прежде чем
// проявить страницу, чтобы названия с сервера не сменились уже после.
export function trackLanguageWork(promise) {
  pendingWork.push(promise);
}

export function settleLanguageWork(timeoutMs) {
  const work = pendingWork;
  pendingWork = [];
  const timeout = new Promise((resolve) => setTimeout(resolve, timeoutMs));
  return Promise.race([Promise.allSettled(work), timeout]);
}
