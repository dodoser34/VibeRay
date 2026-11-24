import { useMemo } from 'react';
import { getCities, getCity } from '@/shared/api/endpoints/cities';
import { useRequest } from './useRequest';

// Все города VibeRay: [{ slug, name, country, center, bbox }] или null, пока список грузится.
export function useCities() {
  return useRequest('cities', getCities).data;
}

// Районы города slug для выбора своего района: [{ slug, name }] по алфавиту; null — город ещё
// грузится или не выбран. Тот же запрос (и кэш ключа), что у карты города.
export function useCityDistricts(slug) {
  const city = useRequest(slug ? `city:${slug}` : null, () => getCity(slug));
  const data = city.data?.slug === slug ? city.data : null;
  return useMemo(
    () =>
      data?.districts.features
        .map((feature) => ({ slug: feature.properties.slug, name: feature.properties.name }))
        .sort((a, b) => a.name.localeCompare(b.name)) ?? null,
    [data],
  );
}
