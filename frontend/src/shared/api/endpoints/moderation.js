import { request } from '../client';

// Только для модератора (ARCHITECTURE.md 7): остальным — 403 forbidden.

// Очередь проблем города city: status — active | new | confirmed | in_progress | resolved | rejected;
// sort — newest | oldest | confirmations. → { total, items } (не больше 100, с автором и историей).
export function getModerationQueue({ city, status, district, category, sort } = {}) {
  return request('GET', '/moderation/problems', {
    query: { city, status, district, category, sort },
  });
}

// Сводка по городу city: счётчики по статусам, районы с открытыми проблемами, категории, скорость
// решения.
export function getModerationSummary(city) {
  return request('GET', '/moderation/summary', { query: { city } });
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
