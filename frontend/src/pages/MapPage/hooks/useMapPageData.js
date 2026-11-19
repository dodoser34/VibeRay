import { useEffect, useMemo } from 'react';
import { rememberCity, useCityData } from '@/features/map';
import { mapOverlay, statsMoods, useCityStats, useDistrictStats } from '@/features/stats';
import { getCities } from '@/shared/api/endpoints/cities';
import { getProblem } from '@/shared/api/endpoints/problems';
import { useRequest } from '@/shared/hooks/useRequest';
import { districtFactsFor, resolveOpenProblem } from '../lib/mapState';

// Всё, что страница карты загружает и выводит из адреса: город, настроения и проблемы за период,
// список городов, статистика района и города, открытая проблема, районы и их названия, то, что
// рисуется на районах (настроение или показатель дашборда).
export function useMapPageData({
  citySlug,
  districtSlug,
  problemId,
  isStats,
  period,
  statsPeriod,
  metric,
  problemUpdate,
  userId,
}) {
  const { city, moods, problems } = useCityData(citySlug, period);
  const cities = useRequest('cities', getCities);
  useEffect(() => {
    if (city.data?.slug) rememberCity(city.data.slug);
  }, [city.data?.slug]);
  const stats = useDistrictStats(isStats ? null : districtSlug, period);
  // Открытая проблема живёт в адресе (/map/:city/problem/:id): ссылкой можно поделиться. Полная
  // карточка (история статусов, «ваше сообщение») приходит отдельным запросом, а пока он идёт —
  // хватает лёгкой версии из списка меток.
  const linked = useRequest(
    !isStats && problemId ? `problem:${problemId}:${userId ?? 'guest'}` : null,
    () => getProblem(problemId),
  );
  const problem = resolveOpenProblem({
    isStats,
    problemId,
    problemUpdate,
    linked: linked.data,
    problems: problems.data,
  });
  const cityStats = useCityStats(isStats ? citySlug : null, statsPeriod);

  const districts = useMemo(
    () =>
      city.data?.districts.features.map((feature) => ({
        slug: feature.properties.slug,
        name: feature.properties.name,
        palette: feature.properties.palette,
      })) ?? [],
    [city.data],
  );
  const names = useMemo(
    () => Object.fromEntries(districts.map((district) => [district.slug, district.name])),
    [districts],
  );
  const overlay = useMemo(
    () => (isStats ? mapOverlay(cityStats.data, metric) : null),
    [isStats, cityStats.data, metric],
  );
  const statsMoodData = useMemo(() => statsMoods(cityStats.data), [cityStats.data]);
  const mapMoods = isStats ? (statsMoodData ?? moods.data) : moods.data;

  const districtFacts = useMemo(
    () => districtFactsFor(districtSlug, city.data, moods.data),
    [districtSlug, city.data, moods.data],
  );

  // Решённая давно проблема уже не на карте, но по прямой ссылке её метка должна появиться.
  const mapProblems = useMemo(() => {
    if (
      !problems.data ||
      !problem ||
      problems.data.some((candidate) => candidate.id === problem.id)
    ) {
      return problems.data;
    }
    return [...problems.data, problem];
  }, [problems.data, problem]);

  const problemMissing = Boolean(problemId && !problem && linked.error);

  return {
    city,
    moods,
    problems,
    cities,
    stats,
    cityStats,
    problem,
    problemMissing,
    districts,
    names,
    overlay,
    mapMoods,
    districtFacts,
    mapProblems,
  };
}
