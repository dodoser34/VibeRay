import { request } from '../client';

// Только для модератора (ARCHITECTURE.md 7): остальным — 403 forbidden.

// Очередь проблем: status — active | new | confirmed | in_progress | resolved | rejected;
// sort — newest | oldest | confirmations. → { total, items } (не больше 100, с автором и историей).
export function getModerationQueue({ status, district, category, sort } = {}) {
  return request('GET', '/moderation/problems', { query: { status, district, category, sort } });
}

// Сводка: счётчики по статусам, районы с открытыми проблемами, категории, скорость решения.
export function getModerationSummary() {
  return request('GET', '/moderation/summary');
}

// Решение модератора: в работу, решена или отклонена (reason, для дубля — duplicateOf).
export function changeProblemStatus(problemId, { status, reason, duplicateOf }) {
  return request('PATCH', `/problems/${problemId}/status`, {
    body: { status, reason, duplicate_of: duplicateOf },
  });
}

export function getSupportRequests() {
  return request('GET', '/moderation/support-requests');
}

// status — new | answered.
export function updateSupportRequest(requestId, status) {
  return request('PATCH', `/moderation/support-requests/${requestId}`, { body: { status } });
}
