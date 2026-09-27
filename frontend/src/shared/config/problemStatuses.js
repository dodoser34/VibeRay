import dictionaries from '@/texts/dictionaries.json';

// Коды должны совпадать с backend/app/models/enums.py (ProblemStatus).
export const PROBLEM_STATUSES = [
  { code: 'new', label: dictionaries.problemStatuses.new, colorVar: '--status-new' },
  {
    code: 'confirmed',
    label: dictionaries.problemStatuses.confirmed,
    colorVar: '--status-confirmed',
  },
  {
    code: 'in_progress',
    label: dictionaries.problemStatuses.in_progress,
    colorVar: '--status-in-progress',
  },
  { code: 'resolved', label: dictionaries.problemStatuses.resolved, colorVar: '--status-resolved' },
];

export const STATUS_BY_CODE = Object.fromEntries(PROBLEM_STATUSES.map((s) => [s.code, s]));
