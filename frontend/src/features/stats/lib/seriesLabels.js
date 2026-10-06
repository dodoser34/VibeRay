import {
  formatDate,
  formatLongDate,
  formatMonth,
  formatMonthYear,
  formatTime,
  formatWeekday,
} from '@/shared/lib/formatDate';

// Подпись оси X для точки динамики или null, если точка остаётся без подписи (подписи разнесены
// так, чтобы не сталкиваться, отсчёт от последней точки).
export function seriesTick(series, i, period) {
  const date = new Date(series[i].t);
  const fromEnd = series.length - 1 - i;
  switch (period) {
    case 'day':
      return date.getHours() % 6 === 0 ? formatTime(date) : null;
    case 'week':
      return formatWeekday(date);
    case 'month':
      return fromEnd % 7 === 0 ? formatDate(date) : null;
    case 'year':
      return fromEnd % 2 === 0 ? formatMonth(date) : null;
    default:
      return date.getMonth() === 0 || (i === 0 && date.getMonth() < 9)
        ? String(date.getFullYear())
        : null;
  }
}

// Точка «дня» — трёхчасовой интервал (ARCHITECTURE.md 6.3): «09:00–12:00».
const DAY_STEP_MS = 3 * 3_600_000;

export function seriesPointTitle(t, period) {
  if (period === 'day')
    return `${formatTime(t)}–${formatTime(new Date(t).getTime() + DAY_STEP_MS)}`;
  if (period === 'week' || period === 'month') return formatLongDate(t);
  return formatMonthYear(t);
}

// Месячные точки всей истории, сгруппированные по календарным годам (настроение взвешено по числу
// отметок).
export function groupByYear(series) {
  const years = new Map();
  series.forEach((point) => {
    const year = new Date(point.t).getFullYear();
    const entry = years.get(year) ?? { year, marks: 0, problems: 0, weighted: 0, scored: 0 };
    entry.marks += point.marks;
    entry.problems += point.problems;
    if (point.score !== null) {
      entry.weighted += point.score * point.marks;
      entry.scored += point.marks;
    }
    years.set(year, entry);
  });
  return [...years.values()].map(({ weighted, scored, ...entry }) => ({
    ...entry,
    score: scored ? weighted / scored : null,
  }));
}
