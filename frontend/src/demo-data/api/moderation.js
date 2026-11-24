import { PROBLEM_CATEGORIES } from '@/shared/config/problemCategories';
import { OPEN_SUPPORT_STATUSES } from '@/shared/config/support';
import {
  HOME_CITY,
  cityBySlug,
  cityMoods,
  cityOfDistrict,
  problems as allProblems,
} from './demoHistory';
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
// Модератор работает с одним выбранным городом за раз: очередь и сводка — только по нему.
// Геометрию города обработчик загружает до вызова (loadCity), поэтому cityBySlug здесь не пустой.
const ownProblems = (city) =>
  allProblems.filter((problem) => cityOfDistrict(problem.district) === city);
const districtNames = (city) =>
  Object.fromEntries(
    cityBySlug(city).districts.features.map((feature) => [
      feature.properties.slug,
      nameOf(feature.properties),
    ]),
  );

export const isQueueStatus = (code) => code in QUEUE_STATUSES;

// Модератор видит и автора анонимной проблемы — чтобы отличать спам; наружу (UserPublic) он не уходит.
export function moderationItem(problem, names = districtNames(cityOfDistrict(problem.district))) {
  return { ...withHistory(problem), district_name: names[problem.district] };
}

export function moderationQueue({
  city = HOME_CITY,
  status = 'active',
  district,
  category,
  sort = 'newest',
}) {
  const names = districtNames(city);
  const matching = ownProblems(city)
    .filter(
      (problem) =>
        QUEUE_STATUSES[status].includes(problem.status) &&
        (!district || problem.district === district) &&
        (!category || problem.category === category),
    )
    .sort(SORTS[sort] ?? SORTS.newest);
  return {
    total: matching.length,
    items: matching.slice(0, QUEUE_LIMIT).map((problem) => moderationItem(problem, names)),
  };
}

// Сводка для модератора: что ждёт решения, где проблемы копятся и как быстро их решают.
export function moderationSummary(supportRequests, city = HOME_CITY) {
  const now = Date.now();
  const names = districtNames(city);
  const moods = cityMoods(city, 'week').districts;
  const cityProblems = ownProblems(city);
  const counts = Object.fromEntries([...ACTIVE, 'resolved', 'rejected'].map((code) => [code, 0]));
  cityProblems.forEach((problem) => (counts[problem.status] += 1));

  const resolvedRecently = cityProblems
    .filter((problem) => problem.status === 'resolved')
    .map((problem) => ({ problem, resolvedTime: resolvedAt(problem) }))
    .filter(({ resolvedTime }) => resolvedTime && now - resolvedTime < 30 * DAY);
  const resolutionDays = resolvedRecently.map(
    ({ problem, resolvedTime }) => (resolvedTime - new Date(problem.created_at).getTime()) / DAY,
  );

  const open = cityProblems.filter((problem) => ACTIVE.includes(problem.status));
  const districts = Object.keys(names)
    .map((slug) => {
      const inDistrict = open.filter((problem) => problem.district === slug);
      const mood = moods[slug];
      return {
        slug,
        name: names[slug],
        open: inDistrict.length,
        waiting: inDistrict.filter((problem) => problem.status !== 'in_progress').length,
        new_week: cityProblems.filter(
          (problem) => problem.district === slug && ageDays(problem, now) < 7,
        ).length,
        oldest_open_days: inDistrict.length
          ? Math.floor(Math.max(...inDistrict.map((problem) => ageDays(problem, now))))
          : null,
        mood_score: mood.insufficient_data ? null : mood.score,
      };
    })
    .sort((a, b) => b.open - a.open || a.name.localeCompare(b.name));

  return {
    counts,
    new_today: cityProblems.filter((problem) => ageDays(problem, now) < 1).length,
    stale_confirmed: open.filter(
      (problem) => problem.status === 'confirmed' && ageDays(problem, now) >= STALE_DAYS,
    ).length,
    resolved_week: resolvedRecently.filter(({ resolvedTime }) => now - resolvedTime < 7 * DAY)
      .length,
    avg_resolution_days: resolutionDays.length
      ? Math.round(
          (resolutionDays.reduce((sum, days) => sum + days, 0) / resolutionDays.length) * 10,
        ) / 10
      : null,
    support_new: supportRequests.filter((request) => OPEN_SUPPORT_STATUSES.includes(request.status))
      .length,
    districts,
    categories: PROBLEM_CATEGORIES.map(({ code }) => ({
      code,
      open: open.filter((problem) => problem.category === code).length,
    })).sort((a, b) => b.open - a.open),
  };
}
