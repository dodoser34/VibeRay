import { getCity, getCityMoods } from '@/shared/api/endpoints/cities';
import { getProblems } from '@/shared/api/endpoints/problems';
import { useRequest } from '@/shared/hooks/useRequest';

export function useCityData(citySlug, period = 'day') {
  const city = useRequest(citySlug ? `city:${citySlug}` : null, () => getCity(citySlug));
  const moods = useRequest(citySlug ? `moods:${citySlug}:${period}` : null, () =>
    getCityMoods(citySlug, period),
  );
  const problems = useRequest(citySlug ? `problems:${citySlug}` : null, () =>
    getProblems({ city: citySlug }),
  );
  return { city, moods, problems };
}
