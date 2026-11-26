import dictionaries from '@/texts/en/dictionaries.json';
import { withLabels } from './withLabels';

// Коды общие с бэкендом: перечисление ProblemCategory (будущий backend/app/models/enums.py).
export const PROBLEM_CATEGORIES = withLabels(
  [
    { code: 'garbage' },
    { code: 'traffic' },
    { code: 'roads' },
    { code: 'lighting' },
    { code: 'noise' },
    { code: 'drunkenness' },
    { code: 'public_transport' },
    { code: 'parks' },
    { code: 'other' },
  ],
  dictionaries.problemCategories,
);

export const CATEGORY_BY_CODE = Object.fromEntries(
  PROBLEM_CATEGORIES.map((category) => [category.code, category]),
);
