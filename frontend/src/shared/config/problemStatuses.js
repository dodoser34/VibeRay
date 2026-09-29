import dictionaries from '@/texts/ru/dictionaries.json';
import { withLabels } from './withLabels';

// Коды должны совпадать с backend/app/models/enums.py (ProblemStatus, RejectionReason).
// Путь проблемы на карте: новая → подтверждена → в работе → решена.
export const PROBLEM_STATUSES = withLabels(
  [
    { code: 'new', colorVar: '--status-new' },
    { code: 'confirmed', colorVar: '--status-confirmed' },
    { code: 'in_progress', colorVar: '--status-in-progress' },
    { code: 'resolved', colorVar: '--status-resolved' },
  ],
  dictionaries.problemStatuses,
);

// Отклонённое модератором сообщение (спам, дубль, не городская проблема) — вне основного пути: его нет
// на карте и в статистике, видит только автор.
export const [REJECTED_STATUS] = withLabels(
  [{ code: 'rejected', colorVar: '--status-rejected' }],
  dictionaries.problemStatuses,
);

export const REJECTION_REASONS = ['spam', 'duplicate', 'offtopic'];

export const STATUS_BY_CODE = Object.fromEntries(
  [...PROBLEM_STATUSES, REJECTED_STATUS].map((s) => [s.code, s]),
);
