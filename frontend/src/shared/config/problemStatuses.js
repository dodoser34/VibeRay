import dictionaries from '@/texts/ru/dictionaries.json';

// Коды должны совпадать с backend/app/models/enums.py (ProblemStatus, RejectionReason).
// Путь проблемы на карте: новая → подтверждена → в работе → решена.
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

// Отклонённое модератором сообщение (спам, дубль, не городская проблема) — вне основного пути: его нет
// на карте и в статистике, видит только автор.
export const REJECTED_STATUS = {
  code: 'rejected',
  label: dictionaries.problemStatuses.rejected,
  colorVar: '--status-rejected',
};

export const REJECTION_REASONS = ['spam', 'duplicate', 'offtopic'];

export const STATUS_BY_CODE = Object.fromEntries(
  [...PROBLEM_STATUSES, REJECTED_STATUS].map((s) => [s.code, s]),
);
