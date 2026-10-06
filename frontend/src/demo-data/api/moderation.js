import { PROBLEM_CATEGORIES } from '@/shared/config/problemCategories';
import { OPEN_SUPPORT_STATUSES } from '@/shared/config/support';
import { city, cityMoods, problems } from './generate';
import { resolvedAt, withHistory } from './community';
import { nameOf } from './locale';

const DAY = 86_400_000;
const ACTIVE = ['new', 'confirmed', 'in_progress'];
// Фильтр очереди → статусы; «active» — всё, что ждёт решения или работы.
const QUEUE_STATUSES = {
  active: ACTIVE,
  new: ['new'],
  confirmed: ['confirmed'],
  in_progress: ['in_progress'],
  resolved: ['resolved'],
  rejected: ['rejected'],
};
const QUEUE_LIMIT = 100;
// Подтверждённая проблема, которую неделю не берут в работу, — «застряла».
const STALE_DAYS = 7;
const SORTS = {
  newest: (a, b) => b.created_at.localeCompare(a.created_at),
  oldest: (a, b) => a.created_at.localeCompare(b.created_at),
  confirmations: (a, b) => b.confirmations_count - a.confirmations_count,
};

const ageDays = (problem, now) => (now - new Date(problem.created_at).getTime()) / DAY;
const districtNames = () =>
  Object.fromEntries(city.districts.features.map((f) => [f.properties.slug, nameOf(f.properties)]));

export const isQueueStatus = (code) => code in QUEUE_STATUSES;

// Модератор видит и автора анонимной проблемы — чтобы отличать спам; наружу (UserPublic) он не уходит.
export function moderationItem(problem, names = districtNames()) {
  return { ...withHistory(problem), district_name: names[problem.district] };
}

export function moderationQueue({ status = 'active', district, category, sort = 'newest' }) {
  const names = districtNames();
  const matching = problems
    .filter(
      (p) =>
        QUEUE_STATUSES[status].includes(p.status) &&
        (!district || p.district === district) &&
        (!category || p.category === category),
    )
    .sort(SORTS[sort] ?? SORTS.newest);
  return {
    total: matching.length,
    items: matching.slice(0, QUEUE_LIMIT).map((p) => moderationItem(p, names)),
  };
}

// Сводка для модератора: что ждёт решения, где проблемы копятся и как быстро их решают.
export function moderationSummary(supportRequests) {
  const now = Date.now();
  const names = districtNames();
  const moods = cityMoods('week').districts;
  const counts = Object.fromEntries([...ACTIVE, 'resolved', 'rejected'].map((code) => [code, 0]));
  problems.forEach((p) => (counts[p.status] += 1));

  const resolvedRecently = problems
    .filter((p) => p.status === 'resolved')
    .map((p) => ({ problem: p, at: resolvedAt(p) }))
    .filter(({ at }) => at && now - at < 30 * DAY);
  const resolutionDays = resolvedRecently.map(
    ({ problem, at }) => (at - new Date(problem.created_at).getTime()) / DAY,
  );

  const open = problems.filter((p) => ACTIVE.includes(p.status));
  const districts = Object.keys(names)
    .map((slug) => {
      const inDistrict = open.filter((p) => p.district === slug);
      const mood = moods[slug];
      return {
        slug,
        name: names[slug],
        open: inDistrict.length,
        waiting: inDistrict.filter((p) => p.status !== 'in_progress').length,
        new_week: problems.filter((p) => p.district === slug && ageDays(p, now) < 7).length,
        oldest_open_days: inDistrict.length
          ? Math.floor(Math.max(...inDistrict.map((p) => ageDays(p, now))))
          : null,
        mood_score: mood.insufficient_data ? null : mood.score,
      };
    })
    .sort((a, b) => b.open - a.open || a.name.localeCompare(b.name));

  return {
    counts,
    new_today: problems.filter((p) => ageDays(p, now) < 1).length,
    stale_confirmed: open.filter((p) => p.status === 'confirmed' && ageDays(p, now) >= STALE_DAYS)
      .length,
    resolved_week: resolvedRecently.filter(({ at }) => now - at < 7 * DAY).length,
    avg_resolution_days: resolutionDays.length
      ? Math.round((resolutionDays.reduce((sum, d) => sum + d, 0) / resolutionDays.length) * 10) /
        10
      : null,
    support_new: supportRequests.filter((r) => OPEN_SUPPORT_STATUSES.includes(r.status)).length,
    districts,
    categories: PROBLEM_CATEGORIES.map(({ code }) => ({
      code,
      open: open.filter((p) => p.category === code).length,
    })).sort((a, b) => b.open - a.open),
  };
}
