import support from '@/texts/ru/support.json';

// Содержимое помощи. Тексты (вопросы, ответы, темы) лежат в src/texts/{ru,en}/support.json; ответы следуют
// правилам продукта из ARCHITECTURE.md (разделы 5–8) — меняйте их вместе с правилами.

export const POPULAR_QUERIES = support.popularQueries;

// Код темы → иконка и тема обращения, к которой она ведёт (shared/config/support.js).
const CATEGORY_META = [
  {
    code: 'account',
    topic: 'account',
    icon: 'user',
  },
  {
    code: 'map',
    topic: 'map',
    icon: 'map',
  },
  {
    code: 'mood',
    topic: 'mood',
    icon: 'smile',
  },
  {
    code: 'problems',
    topic: 'problems',
    icon: 'pin-alert',
  },
  {
    code: 'security',
    topic: 'security',
    icon: 'shield',
  },
  {
    code: 'technical',
    topic: 'technical',
    icon: 'wrench',
  },
];

// Названия тем читаются при обращении: язык можно сменить на лету.
export const HELP_CATEGORIES = CATEGORY_META.map((meta) => ({
  ...meta,
  get title() {
    return support.categories[meta.code].title;
  },
  get text() {
    return support.categories[meta.code].text;
  },
}));

export const FAQ = support.faq;
