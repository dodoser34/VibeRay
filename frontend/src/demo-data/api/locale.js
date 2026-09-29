import content from '../content.json';

// Язык ответа фейкового API — как у настоящего сервера по заголовку Accept-Language: названия города
// и районов, подписи сервисов и тексты демо-проблем. Ники и описания, которые писали сами жители,
// не переводятся.
let current = 'ru';

export function setResponseLanguage(language) {
  current = content[language] ? language : 'ru';
}

export const demoContent = () => content[current];

export const nameOf = (properties) =>
  (current !== 'ru' && properties[`name_${current}`]) || properties.name;

// Демо-проблемы хранят русский текст из content.json; в ответе он заменяется текстом на языке
// запроса. Обход всего ответа — только ради демо.
export function localizeDemo(value) {
  if (current === 'ru' || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(localizeDemo);
  const result = {};
  Object.entries(value).forEach(([key, item]) => (result[key] = localizeDemo(item)));
  const template = content.ru.problemDescriptions[value.category];
  if (template && value.description === template) {
    result.description = content[current].problemDescriptions[value.category];
  }
  return result;
}
