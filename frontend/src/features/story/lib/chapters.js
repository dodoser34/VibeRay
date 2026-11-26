import { getTheme } from '@/shared/lib/theme/theme';
import about from '@/texts/en/about.json';

// История идеи для страницы «О проекте». Одна глава = CHAPTER единиц шкалы = один экран прокрутки.
// Тексты лежат в src/texts/<язык>/about.json; здесь — только порядок глав.
const CHAPTER = 10;
// Позиция на шкале прокрутки: глава и смещение внутри неё (в тех же единицах).
export const chapterTime = (chapter, offset = 0) => chapter * CHAPTER + offset;

const CHAPTER_IDS = [
  'evening',
  'search',
  'city',
  'mood',
  'problems',
  'living',
  'build',
  'product',
  'final',
];

// Светлая тема — та же история днём: комната при солнце, другие время и первая подпись.
export const isDaylight = () => getTheme() === 'light';

// Тексты глав читаются при каждом обращении: язык можно сменить на лету
// (shared/lib/i18n/language.js).
export const CHAPTERS = CHAPTER_IDS.map((id) => ({
  id,
  get text() {
    if (id === 'evening' && isDaylight()) return about.story.daylight.evening;
    return about.story.chapters[id].text;
  },
  get phrase() {
    return about.story.chapters[id].phrase;
  },
  get question() {
    return about.story.chapters[id].question;
  },
}));

export const story = {
  get stamp() {
    return isDaylight() ? about.story.daylight.stamp : about.story.stamp;
  },
  get screenQuestion() {
    return about.screen.question;
  },
  // Месяц на настенном календаре в комнате.
  get month() {
    return about.story.month;
  },
};

// Полная история автора, показывается под ссылкой «прочитать всю историю».
export const FULL_STORY = about.fullStory;
