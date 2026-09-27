import about from '@/texts/about.json';

// История идеи для страницы «О проекте». Одна глава = CHAPTER единиц шкалы = один экран прокрутки.
// Тексты лежат в src/texts/about.json; здесь — только порядок глав.
export const CHAPTER = 10;

const CHAPTER_IDS = [
  'evening',
  'search',
  'city',
  'mood',
  'problems',
  'living',
  'diploma',
  'product',
  'final',
];

export const CHAPTERS = CHAPTER_IDS.map((id) => ({ id, ...about.story.chapters[id] }));

export const STAMP = about.story.stamp;
export const SCREEN_QUESTION = about.screen.question;
export const CALENDAR = about.story.calendar;

// Полная история автора, показывается под ссылкой «прочитать всю историю».
export const FULL_STORY = about.fullStory;
