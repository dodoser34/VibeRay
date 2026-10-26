import { getLocale } from './language';

const rules = new Map();
// Категории Intl.PluralRules → место формы в массиве из src/texts. Русскому нужны все три; в
// английском и немецком «few» не бывает, в казахском после числа существительное не меняется —
// там во всех трёх местах одно слово.
const SLOT = { one: 0, few: 1, many: 2, other: 2 };

// Формы для чисел 1 / 2 / 5 из src/texts: plural(5, ['отметка', 'отметки', 'отметок']) → 'отметок'.
// В английских текстах формы те же по месту: ['mark', 'marks', 'marks'].
export function plural(count, forms) {
  const locale = getLocale();
  if (!rules.has(locale)) rules.set(locale, new Intl.PluralRules(locale));
  return forms[SLOT[rules.get(locale).select(count)] ?? 2];
}
