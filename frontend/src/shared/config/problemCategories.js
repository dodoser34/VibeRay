import dictionaries from '@/texts/ru/dictionaries.json';

// Коды должны совпадать с backend/app/models/enums.py (ProblemCategory).
export const PROBLEM_CATEGORIES = [
  { code: 'garbage', label: dictionaries.problemCategories.garbage },
  { code: 'traffic', label: dictionaries.problemCategories.traffic },
  { code: 'roads', label: dictionaries.problemCategories.roads },
  { code: 'lighting', label: dictionaries.problemCategories.lighting },
  { code: 'noise', label: dictionaries.problemCategories.noise },
  { code: 'drunkenness', label: dictionaries.problemCategories.drunkenness },
  { code: 'public_transport', label: dictionaries.problemCategories.public_transport },
  { code: 'parks', label: dictionaries.problemCategories.parks },
  { code: 'other', label: dictionaries.problemCategories.other },
];

export const CATEGORY_BY_CODE = Object.fromEntries(PROBLEM_CATEGORIES.map((c) => [c.code, c]));
