import dictionaries from '@/texts/ru/dictionaries.json';
import { withLabels } from './withLabels';

// Коды должны совпадать с backend/app/models/enums.py (ProblemCategory).
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

export const CATEGORY_BY_CODE = Object.fromEntries(PROBLEM_CATEGORIES.map((c) => [c.code, c]));
