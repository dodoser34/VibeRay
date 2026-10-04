// Язык интерфейса: русский (src/texts/ru/*.json — основной), казахский, английский или немецкий
// (src/texts/{kk,en,de}/*.json с теми же ключами). Код везде импортирует русские файлы (`import texts from '@/texts/ru/map.json'`), а этот
// модуль записывает значения нужного языка прямо в эти объекты — на месте, не меняя ссылок на
// вложенные объекты и массивы. Он импортируется первым в main.jsx, чтобы язык был выбран до того, как
// остальные модули прочитают тексты. Смена языка на лету — applyLanguage(): тексты переписываются,
// подписчики (useLanguage) перерисовывают страницу, запросы к API повторяются на новом языке.
// Что должно это учитывать: подписи в справочниках — геттеры (shared/config/withLabels.js), тексты не
// копируются в константы модулей, а элементы, которые SplitText разбирает на слова, получают
// key={language} — иначе React не сможет обновить их текст.
// У каждого языка свой адрес (для поисковиков каждая версия — отдельная страница): русский — без
// префикса (/map/kostanay), остальные — подкаталогом (/en/map/kostanay). Язык берётся из адреса;
// маршруты и ссылки работают с путями без префикса, а localizePath() добавляет его
// (app/useLanguageRoute.js держит адрес и язык согласованными).

import { createListeners } from './listeners';
import { readChoice, writeValue } from './localFlag';
import about from '@/texts/ru/about.json';
import auth from '@/texts/ru/auth.json';
import common from '@/texts/ru/common.json';
import dictionaries from '@/texts/ru/dictionaries.json';
import errors from '@/texts/ru/errors.json';
import home from '@/texts/ru/home.json';
import map from '@/texts/ru/map.json';
import mood from '@/texts/ru/mood.json';
import nav from '@/texts/ru/nav.json';
import notFound from '@/texts/ru/notFound.json';
import notifications from '@/texts/ru/notifications.json';
import problems from '@/texts/ru/problems.json';
import settings from '@/texts/ru/settings.json';
import stats from '@/texts/ru/stats.json';
import support from '@/texts/ru/support.json';
import transition from '@/texts/ru/transition.json';

export const LANGUAGES = ['ru', 'kk', 'en', 'de'];
export const DEFAULT_LANGUAGE = 'ru';
const LOCALES = { ru: 'ru-RU', kk: 'kk-KZ', en: 'en-GB', de: 'de-DE' };
const PREFIXED = LANGUAGES.filter((code) => code !== DEFAULT_LANGUAGE);
const STORAGE_KEY = 'viberay.language';
// Подпапка сайта (GitHub Pages): пути приложения — после неё.
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

// Исходные тексты — теми же импортами, что и в остальном коде (тот же экземпляр модуля и в dev после
// правок). Новый файл в src/texts нужно добавить и сюда.
const texts = {
  about,
  auth,
  common,
  dictionaries,
  errors,
  home,
  map,
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
const translations = { ru: structuredClone(texts) };
Object.entries(
  import.meta.glob(['../../texts/*/*.json', '!../../texts/ru/*.json'], {
    eager: true,
    import: 'default',
  }),
).forEach(([path, section]) => {
  const [code, file] = path.split('/').slice(-2);
  translations[code] ??= {};
  translations[code][file.slice(0, -'.json'.length)] = section;
});

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

// Пути — относительно подпапки сайта, как их видит роутер: '/en/about' → 'en'.
export function languageOfPath(pathname) {
  const first = pathname.split('/')[1];
  return PREFIXED.includes(first) ? first : DEFAULT_LANGUAGE;
}

// '/en/about' → '/about', '/en' → '/'.
export function stripLanguage(pathname) {
  const code = languageOfPath(pathname);
  return code === DEFAULT_LANGUAGE ? pathname : pathname.slice(code.length + 1) || '/';
}

// Путь страницы на нужном языке: '/about' → '/en/about'. Принимает путь без префикса языка.
export function localizePath(path, code = language) {
  if (code === DEFAULT_LANGUAGE) return path;
  return path === '/' ? `/${code}` : `/${code}${path}`;
}

// Язык — из адреса. Старые ссылки с ?lang= переводятся на адрес с префиксом. Адрес без префикса —
// русская версия, но тот, кто раньше сам выбрал другой язык, попадает на свою версию. Язык браузера
// не угадываем: поисковый робот должен видеть по каждому адресу ровно ту версию, что в нём указана.
function detect() {
  const url = new URL(window.location.href);
  const path = url.pathname.startsWith(BASE)
    ? url.pathname.slice(BASE.length) || '/'
    : url.pathname;
  const fromPath = languageOfPath(path);
  const fromQuery = url.searchParams.get('lang');
  url.searchParams.delete('lang');
  let next = fromPath;
  if (LANGUAGES.includes(fromQuery)) next = fromQuery;
  else if (fromPath === DEFAULT_LANGUAGE) next = readChoice(STORAGE_KEY, LANGUAGES) ?? fromPath;
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
if (language !== DEFAULT_LANGUAGE) applyTexts(language);
applyDocument();

if (import.meta.env.DEV) {
  PREFIXED.forEach((code) =>
    Object.keys(translations[code] ?? {})
      .filter((section) => !(section in texts))
      .forEach((section) => console.warn(`[texts] ${section}.json не подключён в language.js`)),
  );
}

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

// Тексты — на новом языке сразу, подписчики перерисовываются. Плавную смену делает
// shared/animations/languageTransition.js.
export function applyLanguage(next) {
  if (next === language || !LANGUAGES.includes(next)) return;
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
