// Язык интерфейса: русский (src/texts/ru/*.json) или английский (src/texts/en/*.json с теми же
// ключами). Код везде импортирует русские файлы (`import texts from '@/texts/ru/map.json'`), а этот
// модуль записывает значения нужного языка прямо в эти объекты — на месте, не меняя ссылок на
// вложенные объекты и массивы. Он импортируется первым в main.jsx, чтобы язык был выбран до того, как
// остальные модули прочитают тексты. Смена языка на лету — applyLanguage(): тексты переписываются,
// подписчики (useLanguage) перерисовывают страницу, запросы к API повторяются на новом языке.
// Что должно это учитывать: подписи в справочниках — геттеры (shared/config/withLabels.js), тексты не
// копируются в константы модулей, а элементы, которые SplitText разбирает на слова, получают
// key={language} — иначе React не сможет обновить их текст.

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

export const LANGUAGES = ['ru', 'en'];
const LOCALES = { ru: 'ru-RU', en: 'en-GB' };
const STORAGE_KEY = 'viberay.language';
// Кто читает по-русски (в том числе на казахском, украинском, белорусском системном языке) —
// получает русский, остальные — английский.
const RUSSIAN_READERS = ['ru', 'kk', 'uk', 'be'];

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
const sectionOf = (path) => path.slice(path.lastIndexOf('/') + 1, -'.json'.length);
const translations = {
  ru: structuredClone(texts),
  en: Object.fromEntries(
    Object.entries(
      import.meta.glob('../../texts/en/*.json', { eager: true, import: 'default' }),
    ).map(([path, section]) => [sectionOf(path), section]),
  ),
};

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

function save(next) {
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // хранилище недоступно (приватный режим) — выбор живёт до перезагрузки
  }
}

// Порядок: ?lang= в адресе (ссылка «на английском», запоминается и убирается из адреса) →
// сохранённый выбор → язык браузера.
function detect() {
  const url = new URL(window.location.href);
  const fromUrl = url.searchParams.get('lang');
  if (LANGUAGES.includes(fromUrl)) {
    save(fromUrl);
    url.searchParams.delete('lang');
    window.history.replaceState(window.history.state, '', url);
    return fromUrl;
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (LANGUAGES.includes(saved)) return saved;
  } catch {
    // хранилище недоступно — определяем по браузеру
  }
  const preferred = (navigator.languages?.[0] ?? navigator.language ?? 'ru').slice(0, 2);
  return RUSSIAN_READERS.includes(preferred.toLowerCase()) ? 'ru' : 'en';
}

let language = detect();
if (language !== 'ru') applyTexts(language);
document.documentElement.lang = language;

if (import.meta.env.DEV) {
  Object.keys(translations.en)
    .filter((section) => !(section in texts))
    .forEach((section) => console.warn(`[texts] ${section}.json не подключён в language.js`));
}

const listeners = new Set();
let pendingWork = [];

export function getLanguage() {
  return language;
}

// Локаль для Intl (даты, числа, сортировка).
export function getLocale() {
  return LOCALES[language];
}

export function subscribeLanguage(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Тексты — на новом языке сразу, подписчики перерисовываются. Плавную смену делает
// shared/animations/languageTransition.js.
export function applyLanguage(next) {
  if (next === language || !LANGUAGES.includes(next)) return;
  language = next;
  applyTexts(next);
  document.documentElement.lang = next;
  save(next);
  listeners.forEach((listener) => listener());
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
