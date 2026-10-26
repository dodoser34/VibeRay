import { multiPolygonAreaKm2 } from '@/shared/lib/geoProjection';

// Чистые расчёты страницы карты (без React): что открыто в панели и факты для панели района.

// Открытая проблема: свежая версия после подтверждения или отправки → полная карточка по ссылке →
// лёгкая версия из списка меток (пока полная грузится).
export function resolveOpenProblem({ isStats, problemId, problemUpdate, linked, problems }) {
  if (isStats || !problemId) return null;
  if (problemUpdate?.id === problemId) return problemUpdate;
  if (linked?.id === problemId) return linked;
  return problems?.find((p) => p.id === problemId) ?? null;
}

// Что показывает панель (боковая или шторка); определяет и положение шторки.
export function panelContent({ isStats, report, reportStep, showsProblem, district }) {
  if (isStats) return 'stats';
  if (report) return `report:${reportStep}`;
  if (showsProblem) return 'problem';
  if (district) return 'district';
  return 'overview';
}

// Факты района, которым нужен весь город: место по настроению, среднее по городу, площадь.
export function districtFactsFor(slug, city, moods) {
  if (!slug || !city) return null;
  const ranked = Object.entries(moods?.districts ?? {})
    .filter(([, aggregate]) => aggregate && !aggregate.insufficient_data)
    .sort((a, b) => b[1].score - a[1].score);
  const rank = ranked.findIndex(([districtSlug]) => districtSlug === slug) + 1;
  const feature = city.districts.features.find((f) => f.properties.slug === slug);
  return {
    rank: rank || null,
    rankTotal: ranked.length,
    cityAverage: ranked.length
      ? ranked.reduce((sum, [, aggregate]) => sum + aggregate.score, 0) / ranked.length
      : null,
    areaKm2: feature ? multiPolygonAreaKm2(feature.geometry.coordinates, city.center) : null,
  };
}
