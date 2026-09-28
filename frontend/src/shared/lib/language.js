// Язык интерфейса: русский (исходные тексты src/texts/*.json) или английский (src/texts/en/*.json с
// теми же ключами). Модуль импортируется первым в main.jsx: до того как остальные модули прочитают
// тексты, английские значения записываются прямо в объекты русских JSON — поэтому код везде
// импортирует тексты одинаково (`import texts from '@/texts/ru/map.json'`), а смена языка —
// перезагрузка страницы с сохранённым выбором.

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
const russian = {
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
const english = import.meta.glob('../../texts/en/*.json', { eager: true, import: 'default' });

const sectionOf = (path) => path.slice(path.lastIndexOf('/') + 1, -'.json'.length);

// Порядок: ?lang= в адресе (ссылка «на английском») → сохранённый выбор → язык браузера.
function detect() {
  const fromUrl = new URLSearchParams(window.location.search).get('lang');
  try {
    if (LANGUAGES.includes(fromUrl)) localStorage.setItem(STORAGE_KEY, fromUrl);
  } catch {
    // без хранилища язык из адреса действует до перезагрузки
  }
  if (LANGUAGES.includes(fromUrl)) return fromUrl;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (LANGUAGES.includes(saved)) return saved;
  } catch {
    // хранилище недоступно (приватный режим) — определяем по браузеру
  }
  const preferred = (navigator.languages?.[0] ?? navigator.language ?? 'ru').slice(0, 2);
  return RUSSIAN_READERS.includes(preferred.toLowerCase()) ? 'ru' : 'en';
}

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

// Значения перевода — поверх исходных, на месте: ссылки на вложенные объекты остаются прежними.
function overlay(target, source, path) {
  Object.entries(source).forEach(([key, value]) => {
    if (isObject(value) && isObject(target[key])) overlay(target[key], value, `${path}.${key}`);
    else target[key] = value;
  });
  if (import.meta.env.DEV) {
    Object.keys(target)
      .filter((key) => !(key in source))
      .forEach((key) => console.warn(`[texts] нет перевода: ${path}.${key}`));
  }
}

const language = detect();

if (language !== 'ru') {
  const translations = Object.fromEntries(
    Object.entries(english).map(([path, texts]) => [sectionOf(path), texts]),
  );
  Object.entries(russian).forEach(([section, texts]) => {
    if (translations[section]) overlay(texts, translations[section], section);
    else if (import.meta.env.DEV) console.warn(`[texts] нет файла перевода: en/${section}.json`);
  });
}
if (import.meta.env.DEV) {
  Object.keys(english)
    .map(sectionOf)
    .filter((section) => !(section in russian))
    .forEach((section) => console.warn(`[texts] ${section}.json не подключён в language.js`));
}
document.documentElement.lang = language;

export function getLanguage() {
  return language;
}

// Локаль для Intl (даты, числа, сортировка).
export function getLocale() {
  return LOCALES[language];
}

// Выбор запоминается в браузере; если хранилище недоступно — остаётся в адресе (?lang=).
export function setLanguage(next) {
  if (next === language || !LANGUAGES.includes(next)) return;
  const url = new URL(window.location.href);
  try {
    localStorage.setItem(STORAGE_KEY, next);
    url.searchParams.delete('lang');
  } catch {
    url.searchParams.set('lang', next);
  }
  window.location.replace(url);
}
