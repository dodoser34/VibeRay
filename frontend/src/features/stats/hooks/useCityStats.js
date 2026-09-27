import { getCityStats } from '@/shared/api/endpoints/cities';
import { useRequest } from '@/shared/hooks/useRequest';

export function useCityStats(citySlug, period) {
  return useRequest(citySlug ? `city-stats:${citySlug}:${period}` : null, () =>
    getCityStats(citySlug, period),
  );
}
