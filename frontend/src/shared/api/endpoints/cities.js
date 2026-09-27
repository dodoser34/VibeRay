import { smoothBoundaries } from '@/shared/lib/smoothBoundaries';
import { request } from '../client';

// Контуры районов приходят обведёнными с растра; здесь они один раз сглаживаются для всех видов.
export function getCity(slug) {
  return request('GET', `/cities/${slug}`).then((city) => ({
    ...city,
    districts: smoothBoundaries(city.districts),
  }));
}

export function getCityMoods(slug, period) {
  return request('GET', `/cities/${slug}/moods`, { query: { period } });
}

export function getCityStats(slug, period) {
  return request('GET', `/cities/${slug}/stats`, { query: { period } });
}
