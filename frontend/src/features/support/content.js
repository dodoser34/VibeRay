import support from '@/texts/ru/support.json';

// Содержимое помощи. Тексты (вопросы, ответы, темы) лежат в src/texts/{ru,en}/support.json; ответы следуют
// правилам продукта из ARCHITECTURE.md (разделы 5–8) — меняйте их вместе с правилами.

export const POPULAR_QUERIES = support.popularQueries;

// Код темы → иконка и тема обращения, к которой она ведёт (shared/config/support.js).
const CATEGORY_META = [
  {
    code: 'account',
    topic: 'account',
    icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8c0-3.3 3.1-6 7-6s7 2.7 7 6',
  },
  {
    code: 'map',
    topic: 'map',
    icon: 'M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20V6.5ZM9 4v13.5M15 6.5V20',
  },
  {
    code: 'mood',
    topic: 'mood',
    icon: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8.5 14.5c1.9 1.6 5.1 1.6 7 0M9 9.5h.01M15 9.5h.01',
  },
  {
    code: 'problems',
    topic: 'problems',
    icon: 'M12 21s-6.5-5.4-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.6 12 21 12 21Zm0-13.5v3.5M12 14h.01',
  },
  {
    code: 'security',
    topic: 'security',
    icon: 'M12 3 5 6v5.5c0 4.3 3 7.9 7 9.5 4-1.6 7-5.2 7-9.5V6l-7-3Zm-2.8 9 2 2 4-4',
  },
  {
    code: 'technical',
    topic: 'technical',
    icon: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3.5 17.5l3 3 5.8-5.8a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4 2.6-2.6Z',
  },
];

export const HELP_CATEGORIES = CATEGORY_META.map((meta) => ({
  ...meta,
  ...support.categories[meta.code],
}));

export const FAQ = support.faq;
